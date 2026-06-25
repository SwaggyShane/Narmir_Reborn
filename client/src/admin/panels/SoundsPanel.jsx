import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getCsrfToken } from '../../utils/api.mjs';

export default function SoundsPanel({ adminFetch, onToast }) {
  const [sounds, setSounds]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [actionName, setActionName] = useState('custom');
  const fileRef = useRef(null);

  const loadSounds = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch('/api/admin/sounds');
      if (data?.error) { onToast('Sounds load error: ' + data.error, 'error'); return; }
      if (Array.isArray(data?.sounds)) setSounds(data.sounds.sort());
    } catch (err) { onToast('Failed to load sounds: ' + (err.message || 'Unknown'), 'error'); }
    finally { setLoading(false); }
  }, [adminFetch, onToast]);

  useEffect(() => { loadSounds(); }, [loadSounds]);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { onToast('Select a file first', 'error'); return; }

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['mp3', 'wav'].includes(ext)) {
      onToast('Only .mp3 and .wav files allowed', 'error');
      return;
    }

    setUploading(true);
    try {
      const csrfToken = getCsrfToken();
      const form = new FormData();
      form.append('soundFile', file);
      if (actionName && actionName !== 'custom') {
        form.append('actionName', actionName);
      }

      const headers = {};
      if (csrfToken) headers['x-csrf-token'] = csrfToken;

      const resp = await fetch('/api/admin/sounds/upload', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: form,
      });
      const data = await resp.json();
      if (data?.error) { onToast('Upload failed: ' + data.error, 'error'); return; }
      onToast('Uploaded: ' + data.filename, 'success');
      if (fileRef.current) fileRef.current.value = '';
      loadSounds();
    } catch (err) { onToast('Upload failed: ' + (err.message || 'Unknown'), 'error'); }
    finally { setUploading(false); }
  }

  async function handleDelete(filename) {
    if (!window.confirm(`Delete "${filename}"?`)) return;
    try {
      const data = await adminFetch('/api/admin/sounds/delete', { method: 'POST', body: { filename } });
      if (data?.error) { onToast('Delete failed: ' + data.error, 'error'); return; }
      onToast('Deleted: ' + filename, 'success');
      setSounds(prev => prev.filter(s => s !== filename));
    } catch (err) { onToast('Delete failed: ' + (err.message || 'Unknown'), 'error'); }
  }

  return (
    <div>
      {/* Upload section */}
      <div style={{ background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, padding: '16px 18px', marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text1)', marginBottom: 10 }}>Upload Sound</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={LABEL}>File (.mp3 / .wav)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".mp3,.wav"
              style={{ ...INPUT, paddingTop: 4 }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={LABEL}>Save As (action name or "custom")</label>
            <input
              style={INPUT}
              value={actionName}
              onChange={e => setActionName(e.target.value)}
              placeholder="custom"
            />
          </div>
          <button onClick={handleUpload} disabled={uploading} style={{ ...BTN_PRIMARY, alignSelf: 'flex-end' }}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
          Leave "custom" to use the original filename. Enter an action name (e.g. "attack") to replace that action sound.
        </div>
      </div>

      {/* Sound list */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text1)' }}>
          Sounds ({sounds.length})
        </span>
        <button onClick={loadSounds} style={{ ...BTN, fontSize: 11, padding: '3px 8px' }} disabled={loading}>
          {loading ? '...' : 'Refresh'}
        </button>
      </div>

      {sounds.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 13, padding: '4px 0' }}>{loading ? 'Loading...' : 'No sound files found.'}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={TABLE}>
            <thead><tr>
              <th style={TH}>Filename</th>
              <th style={TH}>Preview</th>
              <th style={TH}></th>
            </tr></thead>
            <tbody>
              {sounds.map(s => (
                <tr key={s}>
                  <td style={TD}>{s}</td>
                  <td style={TD}>
                    <audio controls style={{ height: 28, maxWidth: 220 }} src={`/sounds/${s}`} preload="none" />
                  </td>
                  <td style={TD}>
                    <button onClick={() => handleDelete(s)} style={{ ...BTN, padding: '3px 8px', fontSize: 11, color: 'var(--red, #e55)', borderColor: 'var(--red, #e55)' }}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const LABEL = { display: 'block', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 3 };
const INPUT = { width: '100%', padding: '6px 8px', background: 'var(--bg3, var(--bg4))', border: '1px solid var(--border2)', borderRadius: 4, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' };
const BTN = { padding: '6px 12px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 4, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' };
const BTN_PRIMARY = { ...BTN, color: 'var(--gold)', borderColor: 'var(--gold)' };
const TABLE = { width: '100%', borderCollapse: 'collapse', fontSize: 12, color: 'var(--text2)' };
const TH = { padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border2)', color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' };
const TD = { padding: '5px 8px', borderBottom: '1px solid var(--border3, #2a2a2a)', whiteSpace: 'nowrap' };
