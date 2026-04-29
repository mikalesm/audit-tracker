'use client';
import * as React from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SignInForm({ authEnabled, devBypass }: { authEnabled: boolean; devBypass: boolean }) {
  const [email, setEmail] = React.useState('auditor@example.test');
  const [name,  setName]  = React.useState('Test Auditor');
  const [busy,  setBusy]  = React.useState(false);

  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const callbackUrl = params.get('callbackUrl') || '/';

  if (authEnabled) {
    return (
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={() => signIn('microsoft-entra-id', { callbackUrl })}
      >
        Continue with Microsoft Entra
      </Button>
    );
  }

  if (devBypass) {
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await signIn('dev-bypass', { email, name, callbackUrl });
        }}
        className="space-y-3"
      >
        <div>
          <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 mb-1.5">Email</div>
          <Input value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 mb-1.5">Display name</div>
          <Input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <Button variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in (dev bypass)'}
        </Button>
        <p className="text-[11px] text-ink-500 text-center">
          Local development only. The first user to sign in becomes the auditor lead.
        </p>
      </form>
    );
  }

  return (
    <div className="text-[12.5px] text-ink-700 dark:text-slate-300 space-y-2">
      <p>Authentication is not configured for this deployment.</p>
      <p className="text-ink-500">
        Set <code className="text-[11px]">AZURE_AD_CLIENT_ID</code>, <code className="text-[11px]">AZURE_AD_TENANT_ID</code>, and <code className="text-[11px]">NEXTAUTH_SECRET</code> in the App Service configuration, or set <code className="text-[11px]">AUTH_DEV_BYPASS=1</code> for local dev.
      </p>
    </div>
  );
}
