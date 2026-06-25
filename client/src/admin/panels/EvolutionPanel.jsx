import React, { useState, useEffect, useCallback } from 'react';

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
      const data = await adminFetch('/api/admin/admin_notes');
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

  useEffect(() => {
    loadWishlist();
    loadNotes();
    loadSuggestions();
  }, [loadWishlist, loadNotes, loadSuggestions]);

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
      onToast('Marked complete', 'success');
      setWishlist(prev => prev.map(w => w.id === id ? { ...w, completed: 1 } : w));
    } catch (err) { onToast('Complete failed: ' + (err.message || 'Unknown'), 'error'); }
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setNoteAdding(true);
    try {
      const data = await adminFetch('/api/admin/admin_notes', { method: 'POST', body: { message: newNote.trim() } });
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
      const data = await adminFetch(`/api/admin/admin_notes/${id}`, { method: 'DELETE' });
      if (data?.error) { onToast('Delete failed: ' + data.error, 'error'); return; }
      onToast('Note deleted', 'success');
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (err) { onToast('Delete failed: ' + (err.message || 'Unknown'), 'error'); }
  }

  const pending = wishlist.filter(w => !w.completed);
  const completed = wishlist.filter(w => w.completed);

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['wishlist', 'Wishlist'], ['notes', 'Admin Notes'], ['suggestions', 'Suggestions']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ ...BTN, color: tab === id ? 'var(--gold)' : 'var(--text3)', borderColor: tab === id ? 'var(--gold)' : 'var(--border2)' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'wishlist' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 3 }}>Category</label>
              <select style={INPUT} value={newWish.category} onChange={e => setNewWish(p => ({ ...p, category: e.target.value }))}>
                {WISHLIST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: 3 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 3 }}>Description</label>
              <input style={INPUT} value={newWish.description} onChange={e => setNewWish(p => ({ ...p, description: e.target.value }))} placeholder="Describe the feature or fix..." />
            </div>
            <button onClick={handleAddWish} disabled={wishAdding || !newWish.description.trim()} style={BTN_PRIMARY}>
              {wishAdding ? '...' : 'Add'}
            </button>
            <button onClick={loadWishlist} style={BTN} disabled={wishLoading}>
              {wishLoading ? '...' : 'Refresh'}
            </button>
          </div>

          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text1)', marginBottom: 6 }}>
            Pending ({pending.length})
          </div>
          {pending.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '4px 0 12px' }}>No pending items.</div>
          ) : (
            <WishTable items={pending} onComplete={handleCompleteWish} />
          )}

          {completed.length > 0 && (
            <>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text3)', marginTop: 12, marginBottom: 6 }}>
                Completed ({completed.length})
              </div>
              <WishTable items={completed} onComplete={null} />
            </>
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 3 }}>New Note</label>
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
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '4px 0' }}>{notesLoading ? 'Loading...' : 'No notes.'}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={loadSuggestions} style={BTN} disabled={suggestLoading}>
              {suggestLoading ? '...' : 'Refresh'}
            </button>
            <span style={{ color: 'var(--text3)', fontSize: 13, alignSelf: 'center' }}>Read-only — player-submitted suggestions</span>
          </div>
          {suggestions.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '4px 0' }}>{suggestLoading ? 'Loading...' : 'No suggestions.'}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
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
                      <td style={TD}>{s.created_at ? new Date(s.created_at * 1000).toLocaleString() : '-'}</td>
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
    <div style={{ overflowX: 'auto', marginBottom: 12 }}>
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
                  <span style={{ color: 'var(--text3)', fontSize: 11 }}>Done</span>
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
