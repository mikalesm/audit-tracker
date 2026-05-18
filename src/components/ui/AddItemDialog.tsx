'use client';
import * as React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface DialogField {
  name: string;
  label: string;
  /** 'text', 'textarea', 'select', 'combo' (free-text + suggestions), 'number' */
  kind: 'text' | 'textarea' | 'select' | 'combo' | 'number';
  required?: boolean;
  placeholder?: string;
  options?: readonly string[];
  /** Default value when the dialog opens. */
  defaultValue?: string;
  /** Help text under the label. */
  help?: string;
}

export interface AddItemDialogProps {
  title: string;
  description?: string;
  fields: readonly DialogField[];
  submitLabel?: string;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  onClose: () => void;
}

/**
 * Centered modal for adding a row to a list. Caller defines the fields,
 * including a "combo" kind that renders an input + datalist so admins can
 * pick an existing section name or type a new one (free-text sections).
 */
export default function AddItemDialog({
  title,
  description,
  fields,
  submitLabel = 'Add',
  onSubmit,
  onClose,
}: AddItemDialogProps) {
  const initial: Record<string, string> = {};
  for (const f of fields) initial[f.name] = f.defaultValue ?? '';
  const [values, setValues] = React.useState<Record<string, string>>(initial);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function set(name: string, v: string) {
    setValues(prev => ({ ...prev, [name]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    for (const f of fields) {
      if (f.required && !values[f.name]?.trim()) {
        setError(`${f.label} is required`);
        return;
      }
    }
    setSubmitting(true);
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 dark:bg-black/60" />
      <div
        className="relative w-[520px] max-w-[92vw] max-h-[90vh] overflow-auto bg-white dark:bg-navy-950 border border-rule dark:border-navy-800 rounded-xl shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3 border-b border-rule dark:border-navy-800 flex items-start justify-between gap-3">
          <div>
            <div className="text-[15px] font-semibold tracking-tight">{title}</div>
            {description && (
              <div className="text-[12px] text-ink-500 dark:text-slate-400 mt-0.5">{description}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-canvas dark:hover:bg-navy-800"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-ink-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3.5">
          {fields.map(f => (
            <div key={f.name}>
              <label className="block text-[12px] font-medium text-ink-700 dark:text-slate-300 mb-1">
                {f.label}{f.required && <span className="text-danger ml-0.5">*</span>}
              </label>
              {f.help && (
                <div className="text-[11.5px] text-ink-500 dark:text-slate-400 mb-1.5 leading-snug">{f.help}</div>
              )}
              {f.kind === 'textarea' ? (
                <textarea
                  value={values[f.name] ?? ''}
                  onChange={e => set(f.name, e.target.value)}
                  placeholder={f.placeholder}
                  rows={3}
                  className="w-full rounded-md border border-rule-strong bg-white dark:bg-navy-900 dark:border-navy-700 px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-navy-400"
                />
              ) : f.kind === 'select' ? (
                <select
                  value={values[f.name] ?? ''}
                  onChange={e => set(f.name, e.target.value)}
                  className="w-full h-9 rounded-md border border-rule-strong bg-white dark:bg-navy-900 dark:border-navy-700 px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-navy-400"
                >
                  <option value="">{f.placeholder ?? '— Select —'}</option>
                  {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.kind === 'combo' ? (
                <>
                  <input
                    list={`dl-${f.name}`}
                    value={values[f.name] ?? ''}
                    onChange={e => set(f.name, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full h-9 rounded-md border border-rule-strong bg-white dark:bg-navy-900 dark:border-navy-700 px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-navy-400"
                  />
                  <datalist id={`dl-${f.name}`}>
                    {f.options?.map(o => <option key={o} value={o} />)}
                  </datalist>
                </>
              ) : (
                <input
                  type={f.kind === 'number' ? 'number' : 'text'}
                  value={values[f.name] ?? ''}
                  onChange={e => set(f.name, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full h-9 rounded-md border border-rule-strong bg-white dark:bg-navy-900 dark:border-navy-700 px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-navy-400"
                />
              )}
            </div>
          ))}
          {error && (
            <div className="text-[12px] text-danger bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-md px-2.5 py-1.5">
              {error}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting}>
              {submitting ? 'Saving…' : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
