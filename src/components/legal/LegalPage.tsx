import Link from 'next/link';
import { LEGAL, type LegalBlock, type LegalDocument } from '@/lib/legal';
import LegalFooter from './LegalFooter';

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === 'string') return <p>{block}</p>;
  if ('list' in block) {
    return (
      <ul className="list-disc pl-5 space-y-1.5">
        {block.list.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px] border border-rule dark:border-navy-700">
        <thead className="bg-canvas dark:bg-navy-800">
          <tr>
            {block.table.head.map(h => (
              <th key={h} className="text-left font-semibold px-3 py-2 border-b border-rule dark:border-navy-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.table.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-rule dark:border-navy-700 last:border-0">
              {row.map((cell, ci) => <td key={ci} className="px-3 py-2 align-top">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LegalPage({ doc }: { doc: LegalDocument }) {
  return (
    <div className="min-h-screen flex flex-col bg-canvas dark:bg-navy-950">
      <header className="border-b border-rule dark:border-navy-800 bg-white dark:bg-navy-950">
        <div className="max-w-[760px] mx-auto px-4 md:px-6 h-14 flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/carpa-tech-logo.png" alt="Carpa Tech" className="w-7 h-7 rounded-md object-contain dark:bg-white/5 dark:p-0.5" />
            <span className="text-[13px] font-semibold tracking-tight">Audit Tracker</span>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <article className="max-w-[760px] mx-auto px-4 md:px-6 py-10">
          <h1 className="text-[22px] font-semibold tracking-tight">{doc.title}</h1>
          <p className="mt-1 text-[12px] text-ink-500 dark:text-slate-400">
            Version {LEGAL.version} · Effective {LEGAL.effectiveDate}
          </p>
          <div className="mt-8 space-y-7 text-[13.5px] leading-relaxed text-ink-700 dark:text-slate-300">
            {doc.sections.map(s => (
              <section key={s.heading} className="space-y-2.5">
                <h2 className="text-[14.5px] font-semibold text-ink-900 dark:text-slate-100">{s.heading}</h2>
                {s.blocks.map((b, i) => <Block key={i} block={b} />)}
              </section>
            ))}
          </div>
        </article>
      </main>

      <LegalFooter className="py-6 border-t border-rule dark:border-navy-800" />
    </div>
  );
}
