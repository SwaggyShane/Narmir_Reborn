import React from 'react';
import ReactDOM from 'react-dom/client';
import GameShell from './GameShell.jsx';
import './tailwind.css';           // This is the important one

// Removed the missing ./index.css

const root = ReactDOM.createRoot(document.getElementById('app'));

root.render(
  <React.StrictMode>
    <GameShell />
  </React.StrictMode>
);