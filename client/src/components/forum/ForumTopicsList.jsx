import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../utils/api';

export default function ForumTopicsList({ board, user, onSelectTopic, onCreateClick }) {
  const [topics, setTopics] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('newest');

  useEffect(() => {
    loadTopics(1);
  }, [board.id, sort]);

  const loadTopics = async (pageNum) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchApi(`/api/forum/boards/${board.id}/topics?page=${pageNum}&sort=${sort}`);
      setTopics(data.topics || []);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Error loading topics:', err);
      setError('Failed to load topics');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    loadTopics(newPage);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return <div className="forum-loading">Loading topics...</div>;
  }

  if (error) {
    return <div className="forum-error">{error}</div>;
  }

  if (!topics || topics.length === 0) {
    return (
      <div className="forum-empty-state">
        <p>No discussions yet in this board.</p>
        {user ? (
          <button className="portal-enter-btn" onClick={onCreateClick}>
            Start First Topic
          </button>
        ) : (
          <p className="forum-auth-note">Sign in to create a topic</p>
        )}
      </div>
    );
  }

  return (
    <div className="forum-topics-section">
      <div className="forum-topics-header">
        <div>
          <h3 className="forum-board-title">{board.name}</h3>
          {board.description && <p className="forum-board-desc">{board.description}</p>}
        </div>
        {user && (
          <button className="portal-enter-btn" onClick={onCreateClick}>
            New Topic
          </button>
        )}
      </div>

      <div className="forum-sort-bar">
        <label>
          Sort by:
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="forum-sort-select">
            <option value="newest">Newest First</option>
            <option value="mostActive">Most Active</option>
            <option value="oldest">Oldest First</option>
          </select>
        </label>
      </div>

      <div className="forum-topics-list">
        {topics.map((topic) => (
          <button
            key={topic.id}
            className="forum-topic-row"
            onClick={() => onSelectTopic(topic)}
          >
            <div className="forum-topic-left">
              <div className="forum-topic-title">{topic.title}</div>
              <div className="forum-topic-meta">
                by {topic.username} • {formatTime(topic.created_at)}
              </div>
            </div>
            <div className="forum-topic-stat">{topic.post_count || 1} posts</div>
            <div className="forum-topic-stat">{formatTime(topic.last_post_at)}</div>
          </button>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="forum-pagination">
          {page > 1 && (
            <button className="forum-pagination-btn" onClick={() => handlePageChange(page - 1)}>
              ← Prev
            </button>
          )}
          <span className="forum-page-info">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <button className="forum-pagination-btn" onClick={() => handlePageChange(page + 1)}>
              Next →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
