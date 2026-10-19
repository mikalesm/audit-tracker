import Link from 'next/link';

export default function LegalFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`no-print text-[11.5px] text-ink-500 dark:text-slate-400 ${className}`}>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span>© {new Date().getFullYear()} Carpa Tech</span>
        <span aria-hidden>·</span>
        <Link href="/terms" className="hover:text-ink-900 dark:hover:text-slate-200 hover:underline">Terms of Use</Link>
        <span aria-hidden>·</span>
        <Link href="/privacy" className="hover:text-ink-900 dark:hover:text-slate-200 hover:underline">Privacy Notice</Link>
      </div>
    </footer>
  );
}
