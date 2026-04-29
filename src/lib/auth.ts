import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import authConfig from './auth.config';
import { upsertUserOnSignIn, getUserByEntraId, type Role } from '@/lib/repository/users';

declare module 'next-auth' {
  interface Session {
    user: {
      id: number;
      entraObjectId: string;
      email: string;
      role: Role;
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
        const email = String(profile.email || user.email || '');
        const name = String(profile.name || user.name || email);
        if (!email) return false;
        const u = await upsertUserOnSignIn(oid, email, name);
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
