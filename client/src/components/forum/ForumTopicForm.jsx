import React, { useState } from 'react';
import { fetchApi } from '../../utils/api';

export default function ForumTopicForm({ board, user, onCreated, onCancel }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (title.trim().length < 3 || title.trim().length > 200) {
      setError('Title must be 3-200 characters');
      return;
    }
    if (content.trim().length < 10 || content.trim().length > 5000) {
      setError('Content must be 10-5000 characters');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetchApi('/api/forum/topics', {
        method: 'POST',
        body: JSON.stringify({
          boardId: board.id,
          title: title.trim(),
          content: content.trim()
        })
      });

      if (res && res.error) {
        setError(res.error);
        return;
      }

      setTitle('');
      setContent('');
      onCreated?.();
    } catch (err) {
      console.error('Error creating topic:', err);
      setError(err.message || 'Failed to create topic');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forum-topic-form-overlay">
      <form className="forum-topic-form" onSubmit={handleSubmit}>
        <h3 className="forum-form-title">Create New Topic</h3>

        <div className="forum-form-group">
          <label className="forum-form-label">Title</label>
          <input
            type="text"
            className="forum-form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Topic title..."
            maxLength="200"
            disabled={loading}
          />
          <div className="forum-form-counter">{title.length} / 200</div>
        </div>

        <div className="forum-form-group">
          <label className="forum-form-label">Content</label>
          <textarea
            className="forum-form-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Describe your topic... (10-5000 characters)"
            maxLength="5000"
            disabled={loading}
          />
          <div className="forum-form-counter">{content.length} / 5000</div>
        </div>

        {error && <div className="forum-form-error">{error}</div>}

        <div className="forum-form-actions">
          <button type="submit" className="portal-enter-btn" disabled={loading}>
            {loading ? 'Creating...' : 'Create Topic'}
          </button>
          <button
            type="button"
            className="forum-form-cancel-btn"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
