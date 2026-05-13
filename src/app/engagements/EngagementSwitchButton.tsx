'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';

export default function EngagementSwitchButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        try {
          const r = await fetch(`/api/engagements/${slug}/switch`, { method: 'POST' });
          if (r.ok) router.push('/');
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className="px-3 h-8 inline-flex items-center rounded border border-navy-700 text-navy-700 text-[12.5px] font-medium hover:bg-navy-50 dark:border-navy-300 dark:text-navy-200 dark:hover:bg-navy-800 disabled:opacity-50"
    >
      {busy ? 'Opening…' : 'Open'}
    </button>
  );
}
