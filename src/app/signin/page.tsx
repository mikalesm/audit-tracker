import { isAuthEnabled, isDevBypassEnabled } from '@/lib/auth';
import Link from 'next/link';
import SignInForm from './SignInForm';
import LegalFooter from '@/components/legal/LegalFooter';

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-canvas dark:bg-navy-950 px-4">
      <div className="w-full max-w-[420px] bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg p-8 shadow-sm">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-7 h-7 rounded bg-navy-700 flex items-center justify-center">
            <span className="text-white text-[11px] font-bold tracking-tight">IT</span>
          </div>
          <div className="text-[14px] font-semibold tracking-tight">Audit Tracker</div>
        </div>
        <h1 className="text-[18px] font-semibold tracking-tight mb-1">Sign in</h1>
        <p className="text-[12.5px] text-ink-500 mb-6 leading-relaxed">
          Use your work account to access the engagement workspace.
        </p>
        <SignInForm
          authEnabled={isAuthEnabled()}
          devBypass={isDevBypassEnabled()}
        />
        <p className="mt-5 text-[11.5px] text-ink-500 dark:text-slate-400 leading-relaxed">
          By signing in you agree to the{' '}
          <Link href="/terms" className="underline hover:text-ink-900 dark:hover:text-slate-200">Terms of Use</Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline hover:text-ink-900 dark:hover:text-slate-200">Privacy Notice</Link>.
        </p>
      </div>
      <LegalFooter />
    </div>
  );
}
