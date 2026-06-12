import React, { useState } from 'react';
import { fetchApi } from '../../utils/api';

export default function ForumPostForm({ topic, user, post, onCreated, onCancel }) {
  const [content, setContent] = useState(post?.content || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isEditing = !!post;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (content.trim().length < 10) {
      setError('Post must be at least 10 characters');
      return;
    }
    if (content.trim().length > 5000) {
      setError('Post cannot exceed 5000 characters');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = isEditing
        ? await fetchApi(`/api/forum/posts/${post.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ content: content.trim() })
          })
        : await fetchApi(`/api/forum/topics/${topic.id}/posts`, {
            method: 'POST',
            body: JSON.stringify({ content: content.trim() })
          });

      if (res && res.error) {
        setError(res.error);
        return;
      }

      setContent('');
      onCreated?.();
    } catch (err) {
      console.error('Error submitting post:', err);
      setError(err.message || 'Failed to submit post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="forum-post-form" onSubmit={handleSubmit}>
      <div className="forum-form-group">
        <label className="forum-form-label">{isEditing ? 'Edit Post' : 'Reply'}</label>
        <textarea
          className="forum-form-textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your thoughts... (10-5000 characters)"
          disabled={loading}
        />
        <div className="forum-form-counter">
          {content.length} / 5000
        </div>
      </div>

      {error && <div className="forum-form-error">{error}</div>}

      <div className="forum-form-actions">
        <button
          type="submit"
          className="portal-enter-btn"
          disabled={loading}
        >
          {loading ? 'Submitting...' : (isEditing ? 'Update' : 'Post')}
        </button>
        {isEditing && onCancel && (
          <button
            type="button"
            className="forum-form-cancel-btn"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
