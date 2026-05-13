import type { NextAuthConfig } from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';

/**
 * Edge-safe NextAuth config. This is imported by `src/middleware.ts` and must NOT
 * touch any Node-only modules (pg, fs, crypto-with-Node-bindings, etc.).
 *
 * The full config (`src/lib/auth.ts`) extends this with DB-touching callbacks
 * for actual sign-in / session resolution at the API-route level.
 */

const isProdAuth = !!(
  process.env.AZURE_AD_CLIENT_ID &&
  process.env.AZURE_AD_TENANT_ID &&
  process.env.NEXTAUTH_SECRET
);

const providers: NextAuthConfig['providers'] = [];

if (isProdAuth) {
  providers.push(MicrosoftEntraID({
    clientId: process.env.AZURE_AD_CLIENT_ID!,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
    issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
  }));
}
// (Credentials provider for dev-bypass lives only in `auth.ts` because its
//  authorize callback hits the DB; not needed for middleware-side JWT decoding.)

export const authConfig: NextAuthConfig = {
  providers,
  secret: process.env.NEXTAUTH_SECRET || 'dev-only-not-secret-change-me',
  // Auth.js v5 refuses requests when the request Host doesn't match a known
  // trusted source unless we opt in. We run behind App Service / localhost in
  // dev / 0.0.0.0 in the Docker smoke test — all legitimate hosts but none
  // match the strict default. Set via env so deployments stay opt-in; default
  // true here keeps middleware happy in CI and Azure both.
  trustHost: process.env.AUTH_TRUST_HOST !== '0',
  session: { strategy: 'jwt' },
  pages: { signIn: '/signin' },
};

export default authConfig;
