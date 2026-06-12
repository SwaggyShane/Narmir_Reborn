import React, { useState, useEffect } from 'react';
import ForumPostForm from './ForumPostForm';
import { fetchApi } from '../../utils/api';

export default function ForumThread({ topic, user, onPostCreated }) {
  const [threadData, setThreadData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingPostId, setEditingPostId] = useState(null);

  useEffect(() => {
    loadPosts(1);
  }, [topic.id]);

  const loadPosts = async (pageNum) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchApi(`/api/forum/topics/${topic.id}/posts?page=${pageNum}`);
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
  };

  const handlePageChange = (newPage) => {
    loadPosts(newPage);
  };

  const handlePostCreated = () => {
    setEditingPostId(null);
    loadPosts(1); // Reload from first page
    onPostCreated?.();
  };

  const handleDeletePost = async (postId) => {
    if (!confirm('Delete this post?')) return;
    try {
      await fetchApi(`/api/forum/posts/${postId}`, { method: 'DELETE' });
      loadPosts(page);
    } catch (err) {
      console.error('Error deleting post:', err);
      alert('Failed to delete post');
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  if (loading) {
    return <div className="forum-loading">Loading thread...</div>;
  }

  if (error) {
    return <div className="forum-error">{error}</div>;
  }

  return (
    <div className="forum-thread-section">
      <div className="forum-thread-header">
        <h2 className="forum-thread-title">{threadData?.title}</h2>
        <div className="forum-thread-meta">
          Started by {threadData?.author_username} • {formatTime(threadData?.created_at)}
        </div>
      </div>

      <div className="forum-posts-list">
        {posts && posts.length > 0 ? (
          posts.map((post, idx) => (
            <div key={post.id} className={`forum-post-item ${post.is_deleted ? 'forum-post-deleted' : ''}`}>
              <div className="forum-post-header">
                <div>
                  <div className="forum-post-author">{post.username}</div>
                  <div className="forum-post-time">
                    {formatTime(post.created_at)}
                    {post.updated_at !== post.created_at && <span className="forum-post-edited"> (edited)</span>}
                  </div>
                </div>
                {user && user.id === post.player_id && !post.is_deleted && (
                  <div className="forum-post-actions">
                    <button className="forum-post-btn" onClick={() => setEditingPostId(post.id)}>
                      Edit
                    </button>
                    <button className="forum-post-btn forum-post-delete-btn" onClick={() => handleDeletePost(post.id)}>
                      Delete
                    </button>
                  </div>
                )}
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
            </div>
          ))
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
}
