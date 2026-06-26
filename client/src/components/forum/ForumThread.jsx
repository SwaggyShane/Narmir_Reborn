import React, { useState, useEffect, useCallback } from 'react';
import ForumPostForm from './ForumPostForm';
import { fetchApi } from '../../utils/api';

function PostAvatar({ post }) {
  if (post.avatarUrl) {
    return (
      <img
        src={post.avatarUrl}
        alt=""
        className="forum-post-avatar-img"
        loading="lazy"
      />
    );
  }
  const letter = (post.username || '?').charAt(0).toUpperCase();
  return <div className="forum-post-avatar forum-post-avatar--fallback">{letter}</div>;
}

function PostBadges({ badges }) {
  if (!badges?.length) return null;
  return (
    <div className="forum-post-badges" aria-label="Forum badges">
      {badges.map((badge) => (
        <span
          key={badge.id}
          className={`forum-post-badge forum-post-badge--${badge.id}`}
          title={badge.tip}
        >
          <span className="forum-post-badge-emoji" aria-hidden="true">{badge.emoji}</span>
          <span className="forum-post-badge-label">{badge.label}</span>
        </span>
      ))}
    </div>
  );
}

const ForumThread = React.memo(function ForumThread({ topic, user, onPostCreated }) {
  const [threadData, setThreadData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingPostId, setEditingPostId] = useState(null);
  const [reportingPostId, setReportingPostId] = useState(null);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [reportSuccess, setReportSuccess] = useState(null);

  const loadPosts = useCallback(async (pageNum) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchApi(`/api/forum/topics/${topic.id}/posts?page=${pageNum}`);
      if (data?.error) {
        setError(data.error);
        return;
      }
      setThreadData(data.topic);
      setPosts(data.posts || []);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Error loading posts:', err);
      setError('Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [topic.id]);

  useEffect(() => {
    loadPosts(1);
  }, [topic.id, loadPosts]);

  const handlePageChange = useCallback((newPage) => {
    loadPosts(newPage);
  }, [loadPosts]);

  const handlePostCreated = useCallback(() => {
    setEditingPostId(null);
    loadPosts(1);
    onPostCreated?.();
  }, [loadPosts, onPostCreated]);

  const handleDeletePost = useCallback((postId) => {
    setDeletingPostId(postId);
  }, []);

  const handleConfirmDelete = useCallback(async (postId) => {
    try {
      const res = await fetchApi(`/api/forum/posts/${postId}`, { method: 'DELETE' });
      if (res?.error) {
        alert(res.error);
        return;
      }
      setDeletingPostId(null);
      loadPosts(page);
    } catch (err) {
      console.error('Error deleting post:', err);
      alert('Failed to delete post');
    }
  }, [page, loadPosts]);

  const handleReportPost = useCallback(async (postId) => {
    try {
      const res = await fetchApi('/api/forum/reports', {
        method: 'POST',
        body: { postId }
      });
      if (res?.error) {
        alert(res.error);
        return;
      }
      setReportSuccess('Post reported');
      setReportingPostId(null);
      setTimeout(() => setReportSuccess(null), 3000);
    } catch (err) {
      console.error('Error reporting post:', err);
      alert('Failed to report post');
    }
  }, []);

  const formatTime = useCallback((timestamp) => new Date(timestamp * 1000).toLocaleString(), []);

  if (loading) {
    return <div className="forum-loading">Loading thread...</div>;
  }

  if (error) {
    return <div className="forum-error">{error}</div>;
  }

  const PAGE_SIZE = 20;

  return (
    <div className="forum-thread-section">
      <div className="forum-thread-toolbar">
        <h2 className="forum-thread-title">{threadData?.title}</h2>
        <div className="forum-thread-meta">
          Started by {threadData?.author_username} | {formatTime(threadData?.created_at)}
          {posts?.length > 0 && ` | ${posts.length} post${posts.length === 1 ? '' : 's'} on this page`}
        </div>
      </div>

      {reportSuccess && (
        <div className="forum-report-success">{reportSuccess}</div>
      )}

      <div className="forum-posts-list">
        {posts && posts.length > 0 ? (
          posts.map((post, index) => {
            const postNum = (page - 1) * PAGE_SIZE + index + 1;
            const isOp = postNum === 1;
            return (
            <div
              key={post.id}
              className={`forum-post-item${isOp ? ' forum-post-op' : ''}${post.is_deleted ? ' forum-post-deleted' : ''}`}
            >
              <div className="forum-post-user-panel">
                <span className="forum-post-number">#{postNum}</span>
                <PostAvatar post={post} />
                <div className="forum-post-username">{post.username || 'deleted'}</div>
                <PostBadges badges={post.badges} />
                {isOp ? <span className="forum-post-op-badge">OP</span> : null}
              </div>
              <div className="forum-post-body">
                <div className="forum-post-header">
                  <div className="forum-post-time">
                    {formatTime(post.created_at)}
                    {post.updated_at !== post.created_at && <span className="forum-post-edited"> (edited)</span>}
                  </div>
                  <div className="forum-post-actions">
                    {user && user.playerId === post.player_id && !post.is_deleted && (
                      <>
                        <button className="forum-post-btn" onClick={() => setEditingPostId(post.id)}>
                          Edit
                        </button>
                        <button className="forum-post-btn forum-post-delete-btn" onClick={() => handleDeletePost(post.id)}>
                          Delete
                        </button>
                      </>
                    )}
                    {user && !post.is_deleted && (
                      <button className="forum-post-btn" onClick={() => setReportingPostId(post.id)}>
                        Report
                      </button>
                    )}
                  </div>
                </div>
                <div className={`forum-post-content ${post.is_deleted ? 'forum-deleted-post' : ''}`}>
                  {post.is_deleted ? '[deleted by author]' : post.content}
                </div>
                {editingPostId === post.id && (
                  <ForumPostForm
                    topic={topic}
                    user={user}
                    post={post}
                    onCreated={handlePostCreated}
                    onCancel={() => setEditingPostId(null)}
                  />
                )}
                {deletingPostId === post.id && (
                  <div className="forum-post-report">
                    <p>Permanently delete this post?</p>
                    <div className="forum-post-report-actions">
                      <button className="forum-post-delete-btn forum-post-btn" onClick={() => handleConfirmDelete(post.id)}>
                        Confirm Delete
                      </button>
                      <button className="forum-form-cancel-btn" onClick={() => setDeletingPostId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {reportingPostId === post.id && (
                  <div className="forum-post-report">
                    <p>Report this post for moderation review?</p>
                    <div className="forum-post-report-actions">
                      <button className="forum-form-submit-btn" onClick={() => handleReportPost(post.id)}>
                        Confirm Report
                      </button>
                      <button className="forum-form-cancel-btn" onClick={() => setReportingPostId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
          })
        ) : (
          <div className="forum-empty-state">
            <p>No posts in this thread yet.</p>
          </div>
        )}
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

      {user && !editingPostId && (
        <ForumPostForm topic={topic} user={user} onCreated={handlePostCreated} />
      )}
    </div>
  );
});

ForumThread.displayName = 'ForumThread';
export default ForumThread;
