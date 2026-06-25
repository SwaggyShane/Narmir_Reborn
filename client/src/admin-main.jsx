import React from 'react';
import { createRoot } from 'react-dom/client';
import AdminAuthGate from './admin/AdminAuthGate.jsx';
import './tailwind.css';

createRoot(document.getElementById('admin-root')).render(
  <React.StrictMode>
    <AdminAuthGate />
  </React.StrictMode>
);
