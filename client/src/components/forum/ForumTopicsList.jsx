import React, { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '../../utils/api';

function formatTime(timestamp) {
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
}

const ForumTopicsList = React.memo(function ForumTopicsList({ board, user, onSelectTopic, onCreateClick }) {
  const [topics, setTopics] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('newest');

  const loadTopics = useCallback(async (pageNum) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchApi(`/api/forum/boards/${board.id}/topics?page=${pageNum}&sort=${sort}`);
      if (data?.error) {
        setError(data.error);
        return;
      }
      setTopics(data.topics || []);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Error loading topics:', err);
      setError('Failed to load topics');
    } finally {
      setLoading(false);
    }
  }, [board.id, sort]);

  useEffect(() => {
    loadTopics(1);
  }, [loadTopics]);

  const handlePageChange = useCallback((newPage) => {
    loadTopics(newPage);
  }, [loadTopics]);

  const handleSortChange = useCallback((e) => {
    setSort(e.target.value);
  }, []);

  if (loading) {
    return <div className="forum-loading">Loading topics...</div>;
  }

  if (error) {
    return <div className="forum-error">{error}</div>;
  }

  if (!topics || topics.length === 0) {
    return (
      <div className="forum-topics-section">
        <div className="forum-topics-toolbar">
          <div>
            <h3 className="forum-board-title">{board.name}</h3>
            {board.description && <p className="forum-board-desc">{board.description}</p>}
          </div>
          {user && (
            <button type="button" className="forum-form-submit-btn" onClick={onCreateClick}>
              New Topic
            </button>
          )}
        </div>
        <div className="forum-empty-state">
          <p>No discussions yet in this board.</p>
          {user ? (
            <button type="button" className="forum-form-submit-btn" onClick={onCreateClick}>
              Start First Topic
            </button>
          ) : (
            <p className="forum-auth-note">Sign in to create a topic</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="forum-topics-section">
      <div className="forum-topics-toolbar">
        <div>
          <h3 className="forum-board-title">{board.name}</h3>
          {board.description && <p className="forum-board-desc">{board.description}</p>}
        </div>
        <div className="forum-sort-bar">
          <label>
            Sort
            <select value={sort} onChange={handleSortChange} className="forum-sort-select">
              <option value="newest">Newest</option>
              <option value="mostActive">Most active</option>
              <option value="oldest">Oldest</option>
            </select>
          </label>
          {user && (
            <button type="button" className="forum-form-submit-btn" onClick={onCreateClick}>
              New Topic
            </button>
          )}
        </div>
      </div>

      <div className="forum-table-wrap forum-topics-table">
        <div className="forum-table-head">
          <span className="col-topic">Topic</span>
          <span className="col-started">Started by</span>
          <span className="col-stat">Replies</span>
          <span className="col-last">Last post</span>
        </div>
        {topics.map((topic) => {
          const replies = Math.max(0, (topic.post_count || 1) - 1);
          return (
            <button
              key={topic.id}
              type="button"
              className={`forum-table-row forum-topic-row${topic.is_pinned ? ' forum-row-pinned' : ''}`}
              onClick={() => onSelectTopic(topic)}
            >
              <div className="forum-col-topic">
                <div className="forum-topic-title-line">
                  {topic.is_pinned ? <span className="forum-pin-badge">Pinned</span> : null}
                  <span className="forum-topic-title">{topic.title}</span>
                </div>
                <span className="forum-topic-preview">
                  {replies === 0 ? 'No replies yet' : `${replies} repl${replies === 1 ? 'y' : 'ies'}`}
                </span>
              </div>
              <div className="forum-col-started">
                <strong>{topic.username}</strong>
                {formatTime(topic.created_at)}
              </div>
              <div className="forum-col-replies forum-col-stat">
                <div className="forum-reply-count">{replies}</div>
              </div>
              <div className="forum-col-last">
                {formatTime(topic.last_post_at)}
              </div>
            </button>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="forum-pagination">
          {page > 1 && (
            <button type="button" className="forum-pagination-btn" onClick={() => handlePageChange(page - 1)}>
              ← Prev
            </button>
          )}
          <span className="forum-page-info">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <button type="button" className="forum-pagination-btn" onClick={() => handlePageChange(page + 1)}>
              Next →
            </button>
          )}
        </div>
      )}
    </div>
  );
});

ForumTopicsList.displayName = 'ForumTopicsList';
export default ForumTopicsList;