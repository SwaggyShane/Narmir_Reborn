import React from 'react';
import { createRoot } from 'react-dom/client';
import { applyColorTheme, readColorTheme } from './utils/colorTheme.js';
import './tailwind.css';
import Portal from './Portal.jsx';

applyColorTheme(readColorTheme());

createRoot(document.getElementById('portal-root')).render(
  <React.StrictMode>
    <Portal />
  </React.StrictMode>,
);
