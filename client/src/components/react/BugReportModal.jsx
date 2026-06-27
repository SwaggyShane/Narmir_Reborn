import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import clsx from 'clsx';
import { apiCall } from '../../utils/api.mjs';
import { toast } from '../../utils/toast.js';
import { useActivePanel } from '../../hooks/useActivePanel.js';
import { usePlayerName } from '../../stores';
import { getCapturedConsoleLog } from '../../utils/consoleCapture.js';

const CATEGORIES = [
  { id: 'bug', label: 'Bug / broken behavior' },
  { id: 'ui', label: 'UI / layout issue' },
  { id: 'gameplay', label: 'Gameplay / balance' },
  { id: 'performance', label: 'Lag / performance' },
  { id: 'other', label: 'Other' },
];

let openHandler = null;

export function showBugReportModal() {
  openHandler?.();
}

export default function BugReportModal() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('bug');
  const [submitting, setSubmitting] = useState(false);
  const playerName = usePlayerName();
  const { activePanel } = useActivePanel();

  useEffect(() => {
    openHandler = () => setOpen(true);
    return () => { openHandler = null; };
  }, []);

  const close = useCallback(() => {
    if (submitting) return;
    setOpen(false);
    setMessage('');
    setCategory('bug');
  }, [submitting]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, close]);

  const submit = async () => {
    const trimmed = message.trim();
    if (trimmed.length < 10) {
      toast('Please describe the issue in at least 10 characters.', 'warn');
      return;
    }
    setSubmitting(true);
    try {
      const data = await apiCall('/api/bug-reports', {
        method: 'POST',
        body: {
          message: trimmed,
          category,
          contextPanel: activePanel,
          pageUrl: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          consoleLog: getCapturedConsoleLog(),
        },
      });
      if (data?.error) {
        toast(data.error, 'error');
        return;
      }
      toast(data?.message || 'Report sent — thank you!', 'success');
      setOpen(false);
      setMessage('');
      setCategory('bug');
    } catch (err) {
      toast(err.message || 'Failed to send report', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bug-report-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--bg2)] p-5 shadow-panel">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="bug-report-title" className="text-lg font-bold text-[var(--gold)]">
              Report a Bug
            </h2>
            <p className="mt-1 text-[13px] leading-6 text-[var(--text3)]">
              Sent to the admin panel{playerName ? ` as ${playerName}` : ''}. Recent console output is attached automatically.
            </p>
          </div>
          <button
            type="button"
            className="base-btn px-2 py-1 text-sm"
            onClick={close}
            disabled={submitting}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <label className="mb-1 block text-[12px] text-[var(--text3)]">Category</label>
        <select
          className="mb-3 w-full rounded-xl border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent1)]"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={submitting}
        >
          {CATEGORIES.map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>

        <label className="mb-1 block text-[12px] text-[var(--text3)]">What happened?</label>
        <textarea
          className="mb-2 min-h-[120px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg3)] p-3 text-[13px] text-[var(--text)] outline-none transition focus:border-[var(--accent1)]"
          placeholder="Steps to reproduce, what you expected, what actually happened..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          disabled={submitting}
        />
        <div className="mb-4 text-[11px] text-[var(--text3)]">
          Context: panel <code className="text-[var(--accent1)]">{activePanel}</code>
          {' | '}{message.trim().length}/2000
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={clsx('base-btn variant-green flex-1 px-4 py-2.5', submitting && 'opacity-60')}
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? 'Sending…' : 'Send Report'}
          </button>
          <button
            type="button"
            className="base-btn px-4 py-2.5"
            onClick={close}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
}