import React from 'react';

const CATEGORY_ICONS = {
  community: '💬',
  warfare: '⚔️',
  alliances: '🤝',
  roleplaying: '🎭',
};

const BOARD_ICONS = ['📜', '🏰', '📢', '🗺️', '🍺', '📖', '⚜️', '✨'];

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

const BoardRow = React.memo(({ board, onSelect, index }) => {
  const icon = BOARD_ICONS[index % BOARD_ICONS.length];
  const latest = board.latest;

  return (
    <button
      type="button"
      className="forum-table-row forum-board-row"
      onClick={() => onSelect(board)}
    >
      <div className="forum-col-board">
        <span className="forum-board-icon" aria-hidden="true">{icon}</span>
        <div>
          <div className="forum-board-name">{board.name}</div>
          {board.description && (
            <div className="forum-board-description">{board.description}</div>
          )}
        </div>
      </div>
      <div className="forum-col-stat">{board.topicCount ?? 0}</div>
      <div className="forum-col-stat">{board.postCount ?? 0}</div>
      <div className="forum-col-last forum-board-last">
        {latest ? (
          <>
            <div className="forum-board-last-title" title={latest.topicTitle}>
              {latest.topicTitle}
            </div>
            <div className="forum-board-last-meta">
              by <span className="forum-board-last-poster">{latest.posterUsername}</span>
              {' | '}
              {formatRelativeTime(latest.postedAt)}
            </div>
          </>
        ) : (
          <span className="forum-board-last-empty">No posts yet</span>
        )}
      </div>
    </button>
  );
});

BoardRow.displayName = 'BoardRow';

const ForumBoards = React.memo(function ForumBoards({ forumIndex, onSelectBoard }) {
  const categories = forumIndex?.categories || [];

  if (!categories.length) {
    return (
      <div className="forum-empty-state">
        <p>No forum boards available.</p>
      </div>
    );
  }

  return (
    <div className="forum-index">
      <div className="forum-index-hero">
        <h1 className="forum-index-title">{forumIndex?.title || 'Kingdom Forums'}</h1>
        <p className="forum-index-subtitle">
          Discuss strategy, forge alliances, and weave tales across the realm.
        </p>
      </div>

      {categories.map((category) => (
        <section key={category.key} className="forum-category-block">
          <header className="forum-category-header">
            <span className="forum-category-icon" aria-hidden="true">
              {CATEGORY_ICONS[category.key] || '📋'}
            </span>
            <div>
              <h2 className="forum-category-title">{category.label}</h2>
              {category.description && (
                <p className="forum-category-desc">{category.description}</p>
              )}
            </div>
          </header>

          {category.boards?.length > 0 ? (
            <div className="forum-table-wrap forum-boards-table forum-boards-table--index">
              <div className="forum-table-head">
                <span className="col-board">Board</span>
                <span className="col-stat">Topics</span>
                <span className="col-stat">Posts</span>
                <span className="col-last">Last Post</span>
              </div>
              {category.boards.map((board, index) => (
                <BoardRow
                  key={board.id}
                  board={board}
                  onSelect={onSelectBoard}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="forum-category-empty">No boards in this category yet.</div>
          )}
        </section>
      ))}
    </div>
  );
});

ForumBoards.displayName = 'ForumBoards';
export default ForumBoards;