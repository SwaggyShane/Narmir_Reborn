import React from 'react';
import ReactDOM from 'react-dom/client';
import GameShell from './GameShell.jsx';
import './tailwind.css';

// Legacy global polyfills — these were previously defined in index.html inline JS.
// Must run before any panel component is imported or rendered.
if (typeof window !== 'undefined') {
  window.escapeHtml = window.escHtml = function (value) {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
}

const root = ReactDOM.createRoot(document.getElementById('app'));

root.render(
  <React.StrictMode>
    <GameShell />
  </React.StrictMode>
);
