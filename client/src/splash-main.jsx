import React from 'react';
import { createRoot } from 'react-dom/client';
import Splash from './Splash.jsx';
import './tailwind.css';

createRoot(document.getElementById('splash-root')).render(<Splash />);
