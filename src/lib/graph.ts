// Microsoft Graph helpers — currently used by the engagement Members page to
// search the firm's Entra tenant when adding a new member.
//
// Auth: app-only via ClientSecretCredential, reusing the same tenant /
// client-id / client-secret as NextAuth's Microsoft Entra provider. The
// AZURE_AD_* env vars are populated only in deployed environments; in local
// dev (no Entra config) `isGraphConfigured()` returns false and callers
// gracefully fall back to plain email entry.
//
// Tenant grant required for the search to actually return results:
//   API permission: Microsoft Graph → User.Read.All  (Application)
//   Then click "Grant admin consent" in the Entra app registration.
// Without that grant the search call returns 403; the route surfaces the
// failure and the UI falls back to plain email entry.

import { ClientSecretCredential } from '@azure/identity';

export interface EntraUser {
  /** Entra object id (oid) — what the app stores as users.entra_object_id. */
  id: string;
  displayName: string | null;
  mail: string | null;
  userPrincipalName: string | null;
  /** 'Member' for the home tenant, 'Guest' for B2B invited users. */
  userType: 'Member' | 'Guest' | null;
}

export interface GraphSearchResult {
  available: boolean;
  users: EntraUser[];
  /** Populated when `available` is false or the call failed. */
  reason?: string;
}

let cached: { token: string; expiresAt: number } | null = null;

export function isGraphConfigured(): boolean {
  return !!(process.env.AZURE_AD_TENANT_ID
    && process.env.AZURE_AD_CLIENT_ID
    && process.env.AZURE_AD_CLIENT_SECRET);
}

async function getGraphToken(): Promise<string> {
  if (cached && cached.expiresAt - Date.now() > 5 * 60_000) return cached.token;
  const cred = new ClientSecretCredential(
    process.env.AZURE_AD_TENANT_ID!,
    process.env.AZURE_AD_CLIENT_ID!,
    process.env.AZURE_AD_CLIENT_SECRET!,
  );
  const t = await cred.getToken('https://graph.microsoft.com/.default');
  if (!t) throw new Error('Failed to acquire Microsoft Graph token');
  cached = { token: t.token, expiresAt: t.expiresOnTimestamp };
  return t.token;
}

/**
 * Search the configured Entra tenant for users whose displayName, mail, or UPN
 * contains `q`. Returns at most `top` matches (default 15). B2B guests are
 * included.
 */
export async function searchEntraUsers(q: string, top = 15): Promise<GraphSearchResult> {
  if (!isGraphConfigured()) {
    return { available: false, users: [], reason: 'Microsoft Graph is not configured for this deployment.' };
  }
  const term = q.trim();
  if (term.length < 2) return { available: true, users: [] };

  const token = await getGraphToken();
  // $search wants quoted "field:value" clauses joined with OR. Backslash-escape
  // any embedded quotes in the term defensively.
  const safe = term.replace(/"/g, '\\"');
  const search = `"displayName:${safe}" OR "mail:${safe}" OR "userPrincipalName:${safe}"`;
  const params = new URLSearchParams({
    $search: search,
    $select: 'id,displayName,mail,userPrincipalName,userType',
    $top: String(Math.min(Math.max(top, 1), 50)),
  });
  const url = `https://graph.microsoft.com/v1.0/users?${params.toString()}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      // Required for $search on /users (advanced query).
      ConsistencyLevel: 'eventual',
    },
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Graph /users search failed (${r.status}): ${body.slice(0, 300)}`);
  }
  const data = await r.json() as { value: EntraUser[] };
  return { available: true, users: data.value };
}
