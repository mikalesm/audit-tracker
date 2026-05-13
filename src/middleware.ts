import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from '@/lib/auth.config';

const PUBLIC_PATHS = [
  '/api/auth',
  '/api/healthz',
  '/signin',
  '/_next',
  '/favicon.ico',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
}

// Edge-only NextAuth instance: this config does not import the DB or any Node-only modules.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return;

  // Auth-unconfigured mode: if neither Entra nor dev-bypass is set, the app runs open
  // (useful for demos / smoke tests). Production deploys must set one of these.
  const authConfigured = !!process.env.AZURE_AD_CLIENT_ID || process.env.AUTH_DEV_BYPASS === '1';
  if (!authConfigured) return;

  if (!req.auth) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    const signin = new URL('/signin', req.nextUrl);
    signin.searchParams.set('callbackUrl', pathname + req.nextUrl.search);
    return NextResponse.redirect(signin);
  }
});

export const config = {
  // Skip healthz entirely so the smoke check (and Azure's health probe) never
  // pays the cost of session decoding and cannot be tripped by auth misconfig.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/healthz|.*\\..*).*)'],
};
