import React, { useState, useEffect } from 'react';
import ForumBoards from './ForumBoards';
import ForumTopicsList from './ForumTopicsList';
import ForumThread from './ForumThread';
import ForumTopicForm from './ForumTopicForm';
import { fetchApi } from '../../utils/api';

export default function ForumSection({ user }) {
  const [view, setView] = useState('boards'); // 'boards' | 'topics' | 'thread'
  const [boards, setBoards] = useState([]);
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTopicForm, setShowTopicForm] = useState(false);

  // Load boards on mount
  useEffect(() => {
    loadBoards();
  }, []);

  const loadBoards = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchApi('/api/forum/boards');
      setBoards(data || []);
    } catch (err) {
      console.error('Error loading boards:', err);
      setError('Failed to load forum boards');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBoard = (board) => {
    setSelectedBoard(board);
    setView('topics');
  };

  const handleSelectTopic = (topic) => {
    setSelectedTopic(topic);
    setView('thread');
  };

  const handleBack = () => {
    if (view === 'topics') {
      setView('boards');
      setSelectedBoard(null);
    } else if (view === 'thread') {
      setView('topics');
      setSelectedTopic(null);
    }
  };

  const handleTopicCreated = () => {
    setShowTopicForm(false);
    // Reload the topics list
    if (selectedBoard) {
      handleSelectBoard(selectedBoard);
    }
  };

  const handlePostCreated = () => {
    // Reload the thread
    if (selectedTopic) {
      handleSelectTopic(selectedTopic);
    }
  };

  if (loading) {
    return (
      <div className="portal-card">
        <h2 className="portal-section-title">Forums</h2>
        <div className="forum-loading">Loading forums...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="portal-card">
        <h2 className="portal-section-title">Forums</h2>
        <div className="forum-error">{error}</div>
        <button className="portal-enter-btn" onClick={loadBoards} style={{ marginTop: '1rem' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="portal-card forum-section">
      <div className="forum-header">
        <h2 className="portal-section-title">Forums</h2>
        {view !== 'boards' && (
          <button className="forum-back-btn" onClick={handleBack}>
            ← Back
          </button>
        )}
      </div>

      {view === 'boards' && <ForumBoards boards={boards} onSelectBoard={handleSelectBoard} />}

      {view === 'topics' && selectedBoard && (
        <>
          <ForumTopicsList board={selectedBoard} user={user} onSelectTopic={handleSelectTopic} onCreateClick={() => setShowTopicForm(true)} />
          {showTopicForm && (
            <ForumTopicForm
              board={selectedBoard}
              user={user}
              onCreated={handleTopicCreated}
              onCancel={() => setShowTopicForm(false)}
            />
          )}
        </>
      )}

      {view === 'thread' && selectedTopic && (
        <ForumThread
          topic={selectedTopic}
          user={user}
          onPostCreated={handlePostCreated}
        />
      )}
    </div>
  );
}
