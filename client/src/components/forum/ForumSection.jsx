import React, { useState, useEffect, useCallback } from 'react';
import ForumBoards from './ForumBoards';
import ForumTopicsList from './ForumTopicsList';
import ForumThread from './ForumThread';
import ForumTopicForm from './ForumTopicForm';
import ModeratorManagementPanel from '../react/ModeratorManagementPanel';
import { fetchApi } from '../../utils/api';

const ForumSection = React.memo(function ForumSection({ user: propUser }) {
  const [user, setUser] = useState(propUser || null);
  const [view, setView] = useState('boards');
  const [boards, setBoards] = useState([]);
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTopicForm, setShowTopicForm] = useState(false);

  const loadBoards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchApi('/api/forum/boards');
      if (data && data.error) {
        setError(data.error);
        return;
      }
      setBoards(data || []);
    } catch (err) {
      console.error('Error loading boards:', err);
      setError('Failed to load forum boards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (propUser) {
      setUser(propUser);
    } else {
      fetchApi('/api/auth/me')
        .then((data) => {
          if (data?.username) setUser(data);
        })
        .catch((err) => console.error('Error loading user:', err));
    }
    loadBoards();
  }, [propUser, loadBoards]);

  const handleSelectBoard = useCallback((board) => {
    setSelectedBoard(board);
    setView('topics');
  }, []);

  const handleSelectTopic = useCallback((topic) => {
    setSelectedTopic(topic);
    setView('thread');
  }, []);

  const handleBack = useCallback(() => {
    setView((prevView) => {
      if (prevView === 'topics') {
        setSelectedBoard(null);
        return 'boards';
      } else if (prevView === 'thread') {
        setSelectedTopic(null);
        return 'topics';
      } else if (prevView === 'moderation') {
        return 'boards';
      }
      return prevView;
    });
  }, []);

  const handleTopicCreated = useCallback(() => {
    setShowTopicForm(false);
    loadBoards();
  }, [loadBoards]);

  const handlePostCreated = useCallback(() => {
    if (selectedTopic) {
      handleSelectTopic(selectedTopic);
    }
  }, [selectedTopic, handleSelectTopic]);

  const handleModClick = useCallback(() => setView('moderation'), []);
  const handleFormCancel = useCallback(() => setShowTopicForm(false), []);

  if (loading) {
    return (
      <div id="forum" className="panel forum-section">
        <h2 className="forum-thread-title">Forums</h2>
        <div className="forum-loading">Loading forums...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div id="forum" className="panel forum-section">
        <h2 className="forum-thread-title">Forums</h2>
        <div className="forum-error">{error}</div>
        <button className="portal-enter-btn" onClick={loadBoards} style={{ marginTop: '1rem' }}>
          Retry
        </button>
      </div>
    );
  }

  const showModButton = user?.isAdmin && view !== 'moderation';
  const showBackButton = view !== 'boards';

  return (
    <div id="forum" className="panel forum-section">
      <div className="forum-header">
        <h2 className="forum-thread-title">Forums</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {showModButton && (
            <button className="forum-back-btn" onClick={handleModClick}>
              ⚙️ Moderation
            </button>
          )}
          {showBackButton && (
            <button className="forum-back-btn" onClick={handleBack}>
              ← Back
            </button>
          )}
        </div>
      </div>

      {view === 'boards' && <ForumBoards boards={boards} onSelectBoard={handleSelectBoard} />}

      {view === 'topics' && selectedBoard && (
        <>
          <ForumTopicsList
            board={selectedBoard}
            user={user}
            onSelectTopic={handleSelectTopic}
            onCreateClick={() => setShowTopicForm(true)}
          />
          {showTopicForm && (
            <ForumTopicForm
              board={selectedBoard}
              user={user}
              onCreated={handleTopicCreated}
              onCancel={handleFormCancel}
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

      {view === 'moderation' && user?.isAdmin && (
        <ModeratorManagementPanel />
      )}
    </div>
  );
});

ForumSection.displayName = 'ForumSection';
export default ForumSection;
