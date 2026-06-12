import React, { useCallback } from 'react';

const BoardCard = React.memo(({ board, onSelect }) => (
  <button
    key={board.id}
    className="forum-board-card"
    onClick={() => onSelect(board)}
  >
    <div className="forum-board-name">{board.name}</div>
    <div className="forum-board-description">{board.description || ''}</div>
    <div className="forum-board-meta">
      <span>{board.topicCount || 0} topics</span>
      <span>•</span>
      <span>{board.postCount || 0} posts</span>
    </div>
  </button>
));

BoardCard.displayName = 'BoardCard';

const ForumBoards = React.memo(function ForumBoards({ boards, onSelectBoard }) {
  if (!boards?.length) {
    return (
      <div className="forum-empty-state">
        <p>No forum boards available.</p>
      </div>
    );
  }

  return (
    <div className="forum-boards-list">
      {boards.map((board) => (
        <BoardCard key={board.id} board={board} onSelect={onSelectBoard} />
      ))}
    </div>
  );
});

ForumBoards.displayName = 'ForumBoards';
export default ForumBoards;
