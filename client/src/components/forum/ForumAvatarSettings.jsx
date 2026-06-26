import React, { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '../../utils/api';

const AVATAR_MODES = [
  { id: 'initials', label: 'Initials', tip: 'Colored letter from your username' },
  { id: 'gravatar', label: 'Gravatar', tip: 'Uses the email on your account' },
  { id: 'custom', label: 'Custom URL', tip: 'Link to an image (https://)' },
];

const ForumAvatarSettings = React.memo(function ForumAvatarSettings({ user, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [avatarMode, setAvatarMode] = useState('initials');
  const [customUrl, setCustomUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [hasEmail, setHasEmail] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchApi('/api/forum/profile');
      if (data?.error) {
        setError(data.error);
        return;
      }
      setAvatarMode(data.avatarMode || 'initials');
      setCustomUrl(data.customAvatarUrl || '');
      setPreviewUrl(data.previewUrl);
      setHasEmail(!!data.hasEmail);
    } catch (err) {
      console.error('Error loading forum profile:', err);
      setError('Failed to load avatar settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadProfile();
  }, [user, loadProfile]);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      const data = await fetchApi('/api/forum/profile', {
        method: 'PATCH',
        body: {
          avatarMode,
          avatarUrl: avatarMode === 'custom' ? customUrl : null,
        },
      });
      if (data?.error) {
        setError(data.error);
        return;
      }
      setPreviewUrl(data.previewUrl);
      onSaved?.(data);
      onClose?.();
    } catch (err) {
      console.error('Error saving forum profile:', err);
      setError('Failed to save avatar settings');
    } finally {
      setSaving(false);
    }
  }, [avatarMode, customUrl, onClose, onSaved]);

  if (!user) return null;

  return (
    <div className="forum-avatar-overlay" role="dialog" aria-labelledby="forum-avatar-title">
      <div className="forum-avatar-modal">
        <div className="forum-avatar-modal-header">
          <h3 id="forum-avatar-title">Forum Avatar</h3>
          <button type="button" className="forum-avatar-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {loading ? (
          <div className="forum-loading">Loading settings...</div>
        ) : (
          <>
            {error && <div className="forum-error forum-avatar-error">{error}</div>}

            <div className="forum-avatar-preview-wrap">
              {previewUrl ? (
                <img src={previewUrl} alt="" className="forum-avatar-preview-img" />
              ) : (
                <div className="forum-avatar-preview-placeholder">?</div>
              )}
              <span className="forum-avatar-preview-label">Preview</span>
            </div>

            <fieldset className="forum-avatar-modes">
              <legend>Avatar source</legend>
              {AVATAR_MODES.map((mode) => (
                <label key={mode.id} className="forum-avatar-mode-option">
                  <input
                    type="radio"
                    name="avatarMode"
                    value={mode.id}
                    checked={avatarMode === mode.id}
                    onChange={() => setAvatarMode(mode.id)}
                    disabled={mode.id === 'gravatar' && !hasEmail}
                  />
                  <span className="forum-avatar-mode-label">{mode.label}</span>
                  <span className="forum-avatar-mode-tip">{mode.tip}</span>
                  {mode.id === 'gravatar' && !hasEmail && (
                    <span className="forum-avatar-mode-warn">No email on account</span>
                  )}
                </label>
              ))}
            </fieldset>

            {avatarMode === 'custom' && (
              <label className="forum-avatar-custom-field">
                Image URL
                <input
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                  className="forum-form-input"
                />
              </label>
            )}

            <div className="forum-avatar-actions">
              <button
                type="button"
                className="forum-form-submit-btn"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Avatar'}
              </button>
              <button type="button" className="forum-form-cancel-btn" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

ForumAvatarSettings.displayName = 'ForumAvatarSettings';
export default ForumAvatarSettings;