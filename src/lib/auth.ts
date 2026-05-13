import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import authConfig from './auth.config';
import { upsertUserOnSignIn, getUserByEntraId, type Role } from '@/lib/repository/users';

// B2B guests have UPNs like  `alice_contoso.com#EXT#@auditor.onmicrosoft.com`.
// Recover the home-tenant email for display; non-guest UPNs pass through.
function normalizeGuestEmail(raw: string): string {
  if (!raw) return '';
  const idx = raw.indexOf('#EXT#');
  if (idx === -1) return raw;
  const localPart = raw.slice(0, idx); // alice_contoso.com
  const at = localPart.lastIndexOf('_');
  if (at === -1) return raw;
  return `${localPart.slice(0, at)}@${localPart.slice(at + 1)}`;
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: number;
      entraObjectId: string;
      email: string;
      role: Role;
      systemRole: 'platform_admin' | 'member';
      name?: string | null;
      image?: string | null;
    };
  }
}

const isProdAuth = !!(
  process.env.AZURE_AD_CLIENT_ID &&
  process.env.AZURE_AD_TENANT_ID &&
  process.env.NEXTAUTH_SECRET
);

const providers = [...authConfig.providers];

// Local-dev convenience: sign in as a fixed test user without a real IdP.
// Activated when AUTH_DEV_BYPASS=1 and no Entra credentials are present.
// (Lives only in this Node-side config because authorize() hits the DB.)
if (!isProdAuth && process.env.AUTH_DEV_BYPASS === '1') {
  providers.push(Credentials({
    id: 'dev-bypass',
    name: 'Dev bypass',
    credentials: {
      email: { label: 'Email', type: 'text' },
      name:  { label: 'Name',  type: 'text' },
    },
    async authorize(c) {
      const email = String(c?.email || 'auditor@example.test');
      const name  = String(c?.name  || 'Test Auditor');
      const oid = `dev::${email}`;
      const user = await upsertUserOnSignIn(oid, email, name);
      return {
        id: String(user.id),
        email: user.email,
        name: user.displayName ?? user.email,
        oid,
      } as unknown as { id: string; email: string; name: string; oid: string };
    },
  }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'microsoft-entra-id' && profile?.oid) {
        const oid = String(profile.oid);
        const p = profile as Record<string, unknown>;
        const pick = (...candidates: unknown[]) => {
          for (const c of candidates) if (typeof c === 'string' && c) return c;
          return '';
        };
        const rawUpn = pick(p.preferred_username, p.upn, p.email, user.email);
        const email = normalizeGuestEmail(rawUpn);
        const name = pick(p.name, user.name, email, rawUpn) || oid;
        const u = await upsertUserOnSignIn(oid, email, name, rawUpn || null);
        if (!u.isActive) return false;
        (user as unknown as { oid: string }).oid = oid;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user && (user as unknown as { oid?: string }).oid) {
        token.oid = (user as unknown as { oid: string }).oid;
      }
      if (token.oid) {
        const u = await getUserByEntraId(String(token.oid));
        if (u) {
          token.dbId = u.id;
          token.role = u.role;
          token.systemRole = u.systemRole;
          token.email = u.email;
          token.name = u.displayName ?? u.email;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.oid && token.dbId) {
        const u = {
          id: Number(token.dbId),
          entraObjectId: String(token.oid),
          email: String(token.email || ''),
          role: (token.role as Role) || ('client_reviewer' as Role),
          systemRole: ((token.systemRole as string) === 'platform_admin' ? 'platform_admin' : 'member') as 'platform_admin' | 'member',
          name: token.name as string | null | undefined,
        };
        (session as unknown as { user: typeof u }).user = u;
      }
      return session;
    },
  },
});

export function isAuthEnabled(): boolean { return isProdAuth; }
export function isDevBypassEnabled(): boolean {
  return !isProdAuth && process.env.AUTH_DEV_BYPASS === '1';
}
