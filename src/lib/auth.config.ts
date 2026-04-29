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
  session: { strategy: 'jwt' },
  pages: { signIn: '/signin' },
};

export default authConfig;
