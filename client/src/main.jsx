import React from 'react';
import ReactDOM from 'react-dom/client';
import GameShell from './GameShell.jsx';
import './tailwind.css';

const root = ReactDOM.createRoot(document.getElementById('app'));

root.render(
  <React.StrictMode>
    <GameShell />
  </React.StrictMode>
);
