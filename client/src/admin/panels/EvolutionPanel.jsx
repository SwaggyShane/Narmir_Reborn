import React, { useState, useEffect, useCallback } from 'react';
import { formatTimestamp } from '../../utils/timestamp.js';

const WISHLIST_CATEGORIES = ['feature', 'bugfix', 'balance', 'content', 'ui', 'performance', 'other'];

export default function EvolutionPanel({ adminFetch, onToast }) {
  const [tab, setTab] = useState('wishlist');

  const [wishlist, setWishlist] = useState([]);
  const [wishLoading, setWishLoading] = useState(false);
  const [newWish, setNewWish] = useState({ category: 'feature', description: '' });
  const [wishAdding, setWishAdding] = useState(false);

  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [noteAdding, setNoteAdding] = useState(false);

  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const [bugReports, setBugReports] = useState([]);
  const [bugLoading, setBugLoading] = useState(false);

  const [changelogEntries, setChangelogEntries] = useState([]);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [newChangelog, setNewChangelog] = useState({ title: '', description: '', category: '' });
  const [changelogPublishing, setChangelogPublishing] = useState(false);

  const loadWishlist = useCallback(async () => {
    setWishLoading(true);
    try {
      const data = await adminFetch('/api/admin/wishlist');
      if (data?.error) { onToast('Wishlist error: ' + data.error, 'error'); return; }
      if (Array.isArray(data)) setWishlist(data);
    } catch (err) { onToast('Failed to load wishlist: ' + (err.message || 'Unknown'), 'error'); }
    finally { setWishLoading(false); }
  }, [adminFetch, onToast]);

  const loadNotes = useCallback(async () => {
    setNotesLoading(true);
    try {
      const data = await adminFetch('/api/admin/admin-notes');
      if (data?.error) { onToast('Notes error: ' + data.error, 'error'); return; }
      if (Array.isArray(data)) setNotes(data);
    } catch (err) { onToast('Failed to load notes: ' + (err.message || 'Unknown'), 'error'); }
    finally { setNotesLoading(false); }
  }, [adminFetch, onToast]);

  const loadSuggestions = useCallback(async () => {
    setSuggestLoading(true);
    try {
      const data = await adminFetch('/api/admin/suggestions');
      if (data?.error) { onToast('Suggestions error: ' + data.error, 'error'); return; }
      if (Array.isArray(data)) setSuggestions(data);
    } catch (err) { onToast('Failed to load suggestions: ' + (err.message || 'Unknown'), 'error'); }
    finally { setSuggestLoading(false); }
  }, [adminFetch, onToast]);

  const loadChangelogEntries = useCallback(async () => {
    setChangelogLoading(true);
    try {
      const data = await adminFetch('/api/admin/changelog-entries');
      if (data?.error) { onToast('Changelog error: ' + data.error, 'error'); return; }
      if (Array.isArray(data)) setChangelogEntries(data);
    } catch (err) { onToast('Failed to load changelog: ' + (err.message || 'Unknown'), 'error'); }
    finally { setChangelogLoading(false); }
  }, [adminFetch, onToast]);

  const loadBugReports = useCallback(async () => {
    setBugLoading(true);
    try {
      const data = await adminFetch('/api/admin/bug-reports');
      if (data?.error) { onToast('Bug reports error: ' + data.error, 'error'); return; }
      if (Array.isArray(data)) setBugReports(data);
    } catch (err) { onToast('Failed to load bug reports: ' + (err.message || 'Unknown'), 'error'); }
    finally { setBugLoading(false); }
  }, [adminFetch, onToast]);

  const migrateLegacyNotes = useCallback(async () => {
    try {
      const oldNotes = localStorage.getItem('narmir_admin_notes');
      if (oldNotes && !localStorage.getItem('narmir_admin_notes_list')) {
        await adminFetch('/api/admin/admin-notes', {
          method: 'POST',
          body: { message: 'Legacy Notes:\n' + oldNotes },
        });
        localStorage.removeItem('narmir_admin_notes');
      }
      const listStr = localStorage.getItem('narmir_admin_notes_list');
      if (listStr) {
        const list = JSON.parse(listStr);
        if (Array.isArray(list)) {
          for (let i = list.length - 1; i >= 0; i--) {
            await adminFetch('/api/admin/admin-notes', {
              method: 'POST',
              body: { message: list[i]?.text || '' },
            });
          }
        }
        localStorage.removeItem('narmir_admin_notes_list');
      }
    } catch {
      /* non-fatal */
    }
  }, [adminFetch]);

  useEffect(() => {
    migrateLegacyNotes().then(() => {
      loadWishlist();
      loadNotes();
      loadSuggestions();
      loadBugReports();
      loadChangelogEntries();
    });
  }, [migrateLegacyNotes, loadWishlist, loadNotes, loadSuggestions, loadBugReports, loadChangelogEntries]);

  async function handleAddWish() {
    if (!newWish.description.trim()) return;
    setWishAdding(true);
    try {
      const data = await adminFetch('/api/admin/wishlist', { method: 'POST', body: newWish });
      if (data?.error) { onToast('Add failed: ' + data.error, 'error'); return; }
      onToast('Wishlist item added', 'success');
      setNewWish({ category: 'feature', description: '' });
      loadWishlist();
    } catch (err) { onToast('Add failed: ' + (err.message || 'Unknown'), 'error'); }
    finally { setWishAdding(false); }
  }

  async function handleCompleteWish(id) {
    try {
      const data = await adminFetch(`/api/admin/wishlist/${id}/complete`, { method: 'POST' });
      if (data?.error) { onToast('Complete failed: ' + data.error, 'error'); return; }
      onToast(
        data?.discordSent ? 'Marked complete — changelog + #updates' : 'Marked complete — changelog saved',
        'success',
      );
      setWishlist(prev => prev.map(w => w.id === id ? { ...w, completed: 1 } : w));
      loadChangelogEntries();
    } catch (err) { onToast('Complete failed: ' + (err.message || 'Unknown'), 'error'); }
  }

  async function handlePublishChangelog() {
    if (!newChangelog.title.trim() || !newChangelog.description.trim()) {
      onToast('Title and description required', 'error');
      return;
    }
    setChangelogPublishing(true);
    try {
      const data = await adminFetch('/api/admin/changelog-entries', {
        method: 'POST',
        body: newChangelog,
      });
      if (data?.error) { onToast('Publish failed: ' + data.error, 'error'); return; }
      onToast(
        data?.discordSent ? 'Published to changelog + #updates' : 'Published to changelog',
        'success',
      );
      setNewChangelog({ title: '', description: '', category: '' });
      loadChangelogEntries();
    } catch (err) { onToast('Publish failed: ' + (err.message || 'Unknown'), 'error'); }
    finally { setChangelogPublishing(false); }
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setNoteAdding(true);
    try {
      const data = await adminFetch('/api/admin/admin-notes', { method: 'POST', body: { message: newNote.trim() } });
      if (data?.error) { onToast('Add failed: ' + data.error, 'error'); return; }
      onToast('Note added', 'success');
      setNewNote('');
      loadNotes();
    } catch (err) { onToast('Add failed: ' + (err.message || 'Unknown'), 'error'); }
    finally { setNoteAdding(false); }
  }

  async function handleDeleteNote(id) {
    if (!window.confirm('Delete this note?')) return;
    try {
      const data = await adminFetch(`/api/admin/admin-notes/${id}`, { method: 'DELETE' });
      if (data?.error) { onToast('Delete failed: ' + data.error, 'error'); return; }
      onToast('Note deleted', 'success');
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (err) { onToast('Delete failed: ' + (err.message || 'Unknown'), 'error'); }
  }

  const pending = wishlist.filter(w => !w.completed);
  const completed = wishlist.filter(w => w.completed);

  return (
    <div>
      <div className="flex gap-1 mb-4 flex-wrap">
        {[['wishlist', 'Wishlist'], ['changelog', 'Changelog'], ['notes', 'Admin Notes'], ['suggestions', 'Suggestions'], ['bugs', 'Bug Reports']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ ...BTN, color: tab === id ? 'var(--gold)' : 'var(--text3)', borderColor: tab === id ? 'var(--gold)' : 'var(--border2)' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'wishlist' && (
        <div>
          <div className="flex gap-2 mb-3 items-end">
            <div className="flex-1">
              <label className="block text-[11px] text-[var(--text3)] uppercase mb-[3px]">Category</label>
              <select style={INPUT} value={newWish.category} onChange={e => setNewWish(p => ({ ...p, category: e.target.value }))}>
                {WISHLIST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex-[3]">
              <label className="block text-[11px] text-[var(--text3)] uppercase mb-[3px]">Description</label>
              <input style={INPUT} value={newWish.description} onChange={e => setNewWish(p => ({ ...p, description: e.target.value }))} placeholder="Describe the feature or fix..." />
            </div>
            <button onClick={handleAddWish} disabled={wishAdding || !newWish.description.trim()} style={BTN_PRIMARY}>
              {wishAdding ? '...' : 'Add'}
            </button>
            <button onClick={loadWishlist} style={BTN} disabled={wishLoading}>
              {wishLoading ? '...' : 'Refresh'}
            </button>
          </div>

          <div className="font-semibold text-[13px] text-[var(--text1)] mb-1.5">
            Pending ({pending.length})
          </div>
          {pending.length === 0 ? (
            <div className="text-[var(--text3)] text-[13px] pt-1 pb-3">No pending items.</div>
          ) : (
            <WishTable items={pending} onComplete={handleCompleteWish} />
          )}

          {completed.length > 0 && (
            <>
              <div className="font-semibold text-[13px] text-[var(--text3)] mt-3 mb-1.5">
                Completed ({completed.length})
              </div>
              <WishTable items={completed} onComplete={null} />
            </>
          )}
        </div>
      )}

      {tab === 'changelog' && (
        <div>
          <div className="text-xs text-[var(--text3)] mb-3 leading-normal max-w-[720px]">
            Publish updates here — appears in-game Changelog panel, admin log, and #updates on Discord.
            Description supports markdown: <code>##</code>, <code>###</code>, <code>**bold**</code>, <code>- bullets</code>, <code>{'>'} quote</code>.
            Plain text auto-formats with emoji + category styling.
          </div>

          <div className="grid gap-2 mb-4 max-w-[640px]">
            <input
              type="text"
              placeholder="Title (e.g. Interface Patch 1.0.7)"
              value={newChangelog.title}
              onChange={(e) => setNewChangelog(v => ({ ...v, title: e.target.value }))}
              style={INPUT}
            />
            <input
              type="text"
              placeholder="Category (optional)"
              value={newChangelog.category}
              onChange={(e) => setNewChangelog(v => ({ ...v, category: e.target.value }))}
              style={INPUT}
            />
            <textarea
              placeholder={'Description (markdown ok)\n\n- **Feature:** detail here\n- **Fix:** another line'}
              value={newChangelog.description}
              onChange={(e) => setNewChangelog(v => ({ ...v, description: e.target.value }))}
              style={{ ...INPUT, minHeight: 120, resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
            />
            <div className="flex gap-2">
              <button onClick={handlePublishChangelog} style={BTN_PRIMARY} disabled={changelogPublishing}>
                {changelogPublishing ? 'Publishing...' : 'Publish to Changelog'}
              </button>
              <button onClick={loadChangelogEntries} style={BTN} disabled={changelogLoading}>
                {changelogLoading ? '...' : 'Refresh'}
              </button>
            </div>
          </div>

          {changelogEntries.length === 0 ? (
            <div className="text-[var(--text3)] text-[13px] py-1">
              {changelogLoading ? 'Loading...' : 'No changelog entries yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table style={TABLE}>
                <thead><tr>
                  {['ID', 'Title', 'Category', 'Source', 'Discord', 'Preview', 'Created'].map(h => <th key={h} style={TH}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {changelogEntries.map(entry => (
                    <tr key={entry.id}>
                      <td style={TD}>{entry.id}</td>
                      <td style={{ ...TD, fontWeight: 600 }}>{entry.title}</td>
                      <td style={TD}>{entry.category || '—'}</td>
                      <td style={TD}>{entry.source || 'manual'}</td>
                      <td style={TD}>{entry.discord_sent ? '✓' : '—'}</td>
                      <td style={{ ...TD, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 360, fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>
                        {(entry.body_md || entry.description || '').slice(0, 180)}{(entry.body_md || entry.description || '').length > 180 ? '…' : ''}
                      </td>
                      <td style={TD}>{formatTimestamp(entry.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div>
          <div className="flex gap-2 mb-3 items-end">
            <div className="flex-1">
              <label className="block text-[11px] text-[var(--text3)] uppercase mb-[3px]">New Note</label>
              <textarea style={{ ...INPUT, resize: 'vertical' }} rows={2} value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Admin note message..." />
            </div>
            <button onClick={handleAddNote} disabled={noteAdding || !newNote.trim()} style={{ ...BTN_PRIMARY, alignSelf: 'flex-end' }}>
              {noteAdding ? '...' : 'Add'}
            </button>
            <button onClick={loadNotes} style={{ ...BTN, alignSelf: 'flex-end' }} disabled={notesLoading}>
              {notesLoading ? '...' : 'Refresh'}
            </button>
          </div>
          {notes.length === 0 ? (
            <div className="text-[var(--text3)] text-[13px] py-1">{notesLoading ? 'Loading...' : 'No notes.'}</div>
          ) : (
            <div className="overflow-x-auto">
              <table style={TABLE}>
                <thead><tr>
                  {['ID', 'Author', 'Message', 'Created', ''].map(h => <th key={h} style={TH}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {notes.map(n => (
                    <tr key={n.id}>
                      <td style={TD}>{n.id}</td>
                      <td style={TD}>{n.author_name || '-'}</td>
                      <td style={{ ...TD, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 400 }}>{n.message}</td>
                      <td style={TD}>{n.created_at ? new Date(n.created_at * 1000).toLocaleString() : '-'}</td>
                      <td style={TD}>
                        <button onClick={() => handleDeleteNote(n.id)} style={{ ...BTN, padding: '3px 8px', fontSize: 11, color: 'var(--red, #e55)', borderColor: 'var(--red, #e55)' }}>Del</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'suggestions' && (
        <div>
          <div className="flex gap-2 mb-3">
            <button onClick={loadSuggestions} style={BTN} disabled={suggestLoading}>
              {suggestLoading ? '...' : 'Refresh'}
            </button>
            <span className="text-[var(--text3)] text-[13px] self-center">Read-only — player-submitted suggestions</span>
          </div>
          {suggestions.length === 0 ? (
            <div className="text-[var(--text3)] text-[13px] py-1">{suggestLoading ? 'Loading...' : 'No suggestions.'}</div>
          ) : (
            <div className="overflow-x-auto">
              <table style={TABLE}>
                <thead><tr>
                  {['ID', 'Kingdom', 'Player', 'Message', 'Created'].map(h => <th key={h} style={TH}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {suggestions.map(s => (
                    <tr key={s.id}>
                      <td style={TD}>{s.id}</td>
                      <td style={TD}>{s.kingdom_name || '-'}</td>
                      <td style={TD}>{s.username || '-'}</td>
                      <td style={{ ...TD, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 440 }}>{s.message}</td>
                      <td style={TD}>{formatTimestamp(s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'bugs' && (
        <div>
          <div className="flex gap-2 mb-3">
            <button onClick={loadBugReports} style={BTN} disabled={bugLoading}>
              {bugLoading ? '...' : 'Refresh'}
            </button>
            <span className="text-[var(--text3)] text-[13px] self-center">In-game bug reports (Discord when configured)</span>
          </div>
          {bugReports.length === 0 ? (
            <div className="text-[var(--text3)] text-[13px] py-1">{bugLoading ? 'Loading...' : 'No bug reports yet.'}</div>
          ) : (
            <div className="overflow-x-auto">
              <table style={TABLE}>
                <thead><tr>
                  {['ID', 'Player', 'Kingdom', 'Category', 'Panel', 'Discord', 'Message', 'Console', 'Created'].map(h => <th key={h} style={TH}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {bugReports.map(r => (
                    <tr key={r.id}>
                      <td style={TD}>{r.id}</td>
                      <td style={TD}>{r.username || '-'}</td>
                      <td style={TD}>{r.kingdom_name || '-'}</td>
                      <td style={TD}>{r.category || '-'}</td>
                      <td style={TD}>{r.context_panel || '-'}</td>
                      <td style={TD}>{r.discord_sent ? '✓' : '—'}</td>
                      <td style={{ ...TD, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 360 }}>{r.message}</td>
                      <td style={{ ...TD, maxWidth: 220, verticalAlign: 'top' }}>
                        {r.console_log ? (
                          <details className="text-[11px] text-[var(--text3)]">
                            <summary className="cursor-pointer text-[var(--accent1)]">
                              {r.console_log.split('\n').length} lines
                            </summary>
                            <pre style={{
                              marginTop: 6,
                              maxHeight: 140,
                              overflow: 'auto',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              fontFamily: 'ui-monospace, monospace',
                              fontSize: 10,
                              lineHeight: 1.45,
                              color: 'var(--text2)',
                            }}
                            >
                              {r.console_log}
                            </pre>
                          </details>
                        ) : '—'}
                      </td>
                      <td style={TD}>{formatTimestamp(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WishTable({ items, onComplete }) {
  return (
    <div className="overflow-x-auto mb-3">
      <table style={TABLE}>
        <thead><tr>
          {['ID', 'Category', 'Description', onComplete ? 'Action' : 'Status'].map(h => <th key={h} style={TH}>{h}</th>)}
        </tr></thead>
        <tbody>
          {items.map(w => (
            <tr key={w.id} style={{ opacity: w.completed ? 0.6 : 1 }}>
              <td style={TD}>{w.id}</td>
              <td style={TD}>{w.category}</td>
              <td style={{ ...TD, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 480 }}>{w.description}</td>
              <td style={TD}>
                {onComplete && !w.completed ? (
                  <button onClick={() => onComplete(w.id)} style={{ ...BTN, padding: '3px 8px', fontSize: 11, color: 'var(--gold)', borderColor: 'var(--gold)' }}>Complete</button>
                ) : (
                  <span className="text-[var(--text3)] text-[11px]">Done</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const INPUT = { width: '100%', padding: '6px 8px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 4, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' };
const BTN = { padding: '6px 12px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 4, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' };
const BTN_PRIMARY = { ...BTN, color: 'var(--gold)', borderColor: 'var(--gold)' };
const TABLE = { width: '100%', borderCollapse: 'collapse', fontSize: 12, color: 'var(--text2)' };
const TH = { padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border2)', color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' };
const TD = { padding: '5px 8px', borderBottom: '1px solid var(--border3, #2a2a2a)', whiteSpace: 'nowrap' };
