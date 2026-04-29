'use client';
import * as React from 'react';
import { signOut } from 'next-auth/react';
import { LogOut, User as UserIcon } from 'lucide-react';

const ROLE_LABEL: Record<string, string> = {
  auditor_lead: 'Lead auditor',
  auditor: 'Auditor',
  client_owner: 'Client owner',
  client_reviewer: 'Client reviewer',
};

export default function UserMenu({ user }: { user: { email: string; role: string } | null }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function on(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    if (open) document.addEventListener('mousedown', on);
    return () => document.removeEventListener('mousedown', on);
  }, [open]);

  if (!user) {
    return (
      <a
        href="/signin"
        className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded border border-rule dark:border-navy-700 text-[12px] hover:bg-canvas dark:hover:bg-navy-800"
      >
        <UserIcon className="w-3 h-3" /> Sign in
      </a>
    );
  }

  const initials = (user.email[0] || '?').toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="h-7 px-1.5 inline-flex items-center gap-1.5 rounded border border-rule dark:border-navy-700 hover:bg-canvas dark:hover:bg-navy-800"
        aria-label="Account menu"
      >
        <span className="w-5 h-5 rounded-full bg-navy-700 text-white text-[10px] font-semibold flex items-center justify-center">
          {initials}
        </span>
        <span className="text-[11.5px] text-ink-700 dark:text-slate-300 max-w-[120px] truncate">
          {user.email}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-30 w-[240px] bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg shadow-lg">
          <div className="px-3 py-2.5 border-b border-rule dark:border-navy-800">
            <div className="text-[12.5px] font-medium truncate">{user.email}</div>
            <div className="text-[10.5px] uppercase tracking-wider text-ink-500 mt-0.5">
              {ROLE_LABEL[user.role] || user.role}
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/signin' })}
            className="w-full text-left px-3 py-2 text-[12.5px] hover:bg-canvas dark:hover:bg-navy-800 inline-flex items-center gap-2"
          >
            <LogOut className="w-3 h-3 text-ink-500" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
