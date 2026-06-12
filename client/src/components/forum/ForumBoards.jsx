import React from 'react';

export default function ForumBoards({ boards, onSelectBoard }) {
  if (!boards || boards.length === 0) {
    return (
      <div className="forum-empty-state">
        <p>No forum boards available.</p>
      </div>
    );
  }

  return (
    <div className="forum-boards-list">
      {boards.map((board) => (
        <button
          key={board.id}
          className="forum-board-card"
          onClick={() => onSelectBoard(board)}
        >
          <div className="forum-board-name">{board.name}</div>
          <div className="forum-board-description">{board.description || ''}</div>
          <div className="forum-board-meta">
            <span>{board.topicCount || 0} topics</span>
            <span>•</span>
            <span>{board.postCount || 0} posts</span>
          </div>
        </button>
      ))}
    </div>
  );
}
