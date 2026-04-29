'use client';
import * as React from 'react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Filter } from 'lucide-react';
import { TSC_VALUES } from '@/lib/utils';

export default function ReportsPage() {
  const [tsc, setTsc] = React.useState<string[]>([]);
  const tscQs = tsc.length > 0 ? `?tsc=${encodeURIComponent(tsc.join(','))}` : '';

  function toggle(v: string) {
    setTsc(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

  return (
    <div className="px-6 py-8 max-w-[900px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[20px] font-semibold tracking-tight">Reports</h1>
        <p className="text-[13px] text-ink-500 dark:text-slate-400 mt-1">
          Generate consulting-grade PDF deliverables. Files are produced locally — no data leaves the machine.
        </p>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Filter className="w-3 h-3" /> Filter by SOC 2 Trust Services Criteria
          </CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-[12.5px] text-ink-500 mb-3">
            Optional. When one or more TSCs are selected, both reports include only PBC items whose mapping intersects the selection. Items with no TSC mapping are excluded.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TSC_VALUES.map(v => {
              const on = tsc.includes(v);
              return (
                <button
                  key={v}
                  onClick={() => toggle(v)}
                  className={`px-2.5 py-1 text-[12px] rounded ring-1 ring-inset transition-colors ${on ? 'bg-navy-700 text-white ring-navy-700' : 'bg-white text-ink-700 ring-rule hover:bg-canvas dark:bg-navy-900 dark:text-slate-300 dark:ring-navy-700'}`}
                >
                  {v}
                </button>
              );
            })}
            {tsc.length > 0 && (
              <button onClick={() => setTsc([])} className="px-2 py-1 text-[12px] text-ink-500 hover:text-ink-900 dark:hover:text-slate-100">Clear</button>
            )}
          </div>
          {tsc.length > 0 && (
            <p className="text-[11.5px] text-ink-500 mt-2 tabular">
              Active filter: <span className="text-ink-700 dark:text-slate-300 font-medium">{tsc.join(', ')}</span>
            </p>
          )}
        </CardBody>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Client Status Report</CardTitle></CardHeader>
          <CardBody>
            <p className="text-[13px] text-ink-700 dark:text-slate-300 mb-4">
              One-page executive summary for client status meetings: KPIs, % complete by category, outstanding High items, and walkthrough schedule. Internal comments are not included.
            </p>
            <div className="flex items-center gap-2">
              <a href={`/api/reports/client${tscQs}`} target="_blank">
                <Button variant="primary" size="md"><Download className="w-3.5 h-3.5" /> Download PDF</Button>
              </a>
              <a href={`/api/reports/client${tscQs}`} className="text-[12px] text-navy-700 dark:text-navy-300 hover:underline">Open in new tab</a>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Full Status Report</CardTitle></CardHeader>
          <CardBody>
            <p className="text-[13px] text-ink-700 dark:text-slate-300 mb-4">
              Complete internal report: KPIs, all categories, full PBC list, access provisioning state, and walkthrough schedule.
            </p>
            <div className="flex items-center gap-2">
              <a href={`/api/reports/full${tscQs}`} target="_blank">
                <Button variant="primary" size="md"><Download className="w-3.5 h-3.5" /> Download PDF</Button>
              </a>
              <a href={`/api/reports/full${tscQs}`} className="text-[12px] text-navy-700 dark:text-navy-300 hover:underline">Open in new tab</a>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader><CardTitle>Excel export</CardTitle></CardHeader>
          <CardBody>
            <p className="text-[13px] text-ink-700 dark:text-slate-300 mb-3">
              Export the current state of all sheets as a fresh Excel workbook. Not affected by TSC filter.
            </p>
            <a href="/api/export"><Button variant="secondary" size="md"><FileText className="w-3.5 h-3.5" /> Download .xlsx</Button></a>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
