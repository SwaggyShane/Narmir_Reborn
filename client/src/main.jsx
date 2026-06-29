import React from 'react';
import ReactDOM from 'react-dom/client';
import GameShell from './GameShell.jsx';
import { applyColorTheme, readColorTheme } from './utils/colorTheme.js';
import { initConsoleCapture } from './utils/consoleCapture.js';
import { initErrorLogging } from './utils/errorLogging.js';
import './tailwind.css';

initConsoleCapture();
initErrorLogging();
applyColorTheme(readColorTheme());

const root = ReactDOM.createRoot(document.getElementById('app'));

root.render(
  <React.StrictMode>
    <GameShell />
  </React.StrictMode>
);
