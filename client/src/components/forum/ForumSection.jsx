import React, { useState, useEffect, useCallback, useRef } from 'react';
import ForumBoards from './ForumBoards';
import ForumTopicsList from './ForumTopicsList';
import ForumThread from './ForumThread';
import ForumTopicForm from './ForumTopicForm';
import ForumAvatarSettings from './ForumAvatarSettings';
import ModeratorManagementPanel from '../react/ModeratorManagementPanel';
import { fetchApi } from '../../utils/api';
import { AppEvent } from '../../utils/appEvents.js';
import { useAppEvent } from '../../hooks/useAppEvent.js';

const ForumSection = React.memo(function ForumSection({ user: propUser, standalone = false, gameShell = false }) {
  const [user, setUser] = useState(propUser || null);
  const [view, setView] = useState('boards');
  const [forumIndex, setForumIndex] = useState(null);
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTopicForm, setShowTopicForm] = useState(false);
  const [showAvatarSettings, setShowAvatarSettings] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const loadForumIndex = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchApi('/api/forum/index');
      if (!isMounted.current) return;
      if (data && data.error) {
        setError(data.error);
        return;
      }
      setForumIndex(data || null);
    } catch (err) {
      console.error('Error loading forum index:', err);
      if (isMounted.current) setError('Failed to load forums');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (propUser) {
      setUser(propUser);
    } else {
      fetchApi('/api/auth/me')
        .then((data) => {
          if (isMounted.current && data?.username) setUser(data);
        })
        .catch((err) => console.error('Error loading user:', err));
    }
    loadForumIndex();
  }, [propUser, loadForumIndex]);

  useAppEvent(AppEvent.FORUM_REFRESH, loadForumIndex);

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
    loadForumIndex();
  }, [loadForumIndex]);

  const handlePostCreated = useCallback(() => {
    if (selectedTopic) {
      handleSelectTopic(selectedTopic);
    }
  }, [selectedTopic, handleSelectTopic]);

  const handleModClick = useCallback(() => setView('moderation'), []);
  const handleFormCancel = useCallback(() => setShowTopicForm(false), []);

  const panelProps = standalone || gameShell
    ? {
        className: `forum-section${gameShell ? ' forum-section--game flex min-h-0 flex-1 flex-col' : ''}`,
      }
    : { id: 'forum', className: 'panel forum-section', style: { display: 'none' } };

  const wrapBody = (body) =>
    gameShell ? <div className="forum-scroll-body">{body}</div> : body;

  const breadcrumb = (() => {
    const crumbs = [{ label: 'Boards', active: view === 'boards' }];
    if (view === 'topics' && selectedBoard) {
      crumbs.push({ label: selectedBoard.name, active: true });
    } else if (view === 'thread' && selectedBoard && selectedTopic) {
      crumbs.push({ label: selectedBoard.name, active: false });
      crumbs.push({ label: selectedTopic.title, active: true });
    } else if (view === 'moderation') {
      crumbs.push({ label: 'Moderation', active: true });
    }
    return crumbs;
  })();

  const forumHeader = (actions) => (
    <div className="forum-header">
      <div>
        <h2 className="forum-header-title">{gameShell ? 'Kingdom Forums' : 'Narmir Forums'}</h2>
        <nav className="forum-breadcrumb" aria-label="Forum location">
          {breadcrumb.map((crumb, i) => (
            <React.Fragment key={`${crumb.label}-${i}`}>
              {i > 0 && <span className="forum-breadcrumb-sep">›</span>}
              <span className={crumb.active ? 'forum-breadcrumb-current' : undefined}>{crumb.label}</span>
            </React.Fragment>
          ))}
        </nav>
      </div>
      {actions ? <div className="forum-header-actions">{actions}</div> : null}
    </div>
  );

  if (loading) {
    return (
      <div {...panelProps}>
        {forumHeader()}
        {wrapBody(<div className="forum-loading">Loading forums...</div>)}
      </div>
    );
  }

  if (error) {
    return (
      <div {...panelProps}>
        {forumHeader(
          <button type="button" className="forum-form-submit-btn" onClick={loadForumIndex}>
            Retry
          </button>,
        )}
        {wrapBody(<div className="forum-error">{error}</div>)}
      </div>
    );
  }

  const showModButton = user?.isAdmin && view !== 'moderation';
  const showBackButton = view !== 'boards';
  const showAvatarButton = user?.playerId && view === 'boards';

  return (
    <div {...panelProps}>
      {forumHeader(
        <>
          {showAvatarButton && (
            <button
              type="button"
              className="forum-back-btn"
              onClick={() => setShowAvatarSettings(true)}
            >
              Avatar
            </button>
          )}
          {showModButton && (
            <button type="button" className="forum-back-btn" onClick={handleModClick}>
              Moderation
            </button>
          )}
          {showBackButton && (
            <button type="button" className="forum-back-btn" onClick={handleBack}>
              ← Back
            </button>
          )}
        </>,
      )}

      {wrapBody(
        <>
          {view === 'boards' && (
            <ForumBoards forumIndex={forumIndex} onSelectBoard={handleSelectBoard} />
          )}

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
        </>,
      )}

      {showAvatarSettings && (
        <ForumAvatarSettings
          user={user}
          onClose={() => setShowAvatarSettings(false)}
        />
      )}
    </div>
  );
});

ForumSection.displayName = 'ForumSection';
export default ForumSection;
