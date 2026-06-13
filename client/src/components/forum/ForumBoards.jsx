import React, { useCallback } from 'react';

const BOARD_COLORS = ['#4a8fb8', '#c8962a', '#8fb84a', '#b43c00', '#4caf82', '#e05c5c'];

const BoardCard = React.memo(({ board, onSelect, index }) => {
  const color = BOARD_COLORS[index % BOARD_COLORS.length];
  return (
    <button
      className="forum-board-card"
      style={{ '--board-color': color }}
      onClick={() => onSelect(board)}
    >
      <div className="forum-board-accent" />
      <div className="forum-board-body">
        <div className="forum-board-name">{board.name}</div>
        <div className="forum-board-description">{board.description || ''}</div>
      </div>
      <div className="forum-board-stats">
        <div className="forum-board-stat-item">
          <div className="forum-board-stat-num">{board.topicCount || 0}</div>
          <div className="forum-board-stat-label">topics</div>
        </div>
        <div className="forum-board-stat-item">
          <div className="forum-board-stat-num">{board.postCount || 0}</div>
          <div className="forum-board-stat-label">posts</div>
        </div>
      </div>
    </button>
  );
});

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
      {boards.map((board, index) => (
        <BoardCard key={board.id} board={board} onSelect={onSelectBoard} index={index} />
      ))}
    </div>
  );
});

ForumBoards.displayName = 'ForumBoards';
export default ForumBoards;
