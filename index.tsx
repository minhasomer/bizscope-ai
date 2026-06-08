
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// BUILD MARKER — remove after DNS/env fix confirmed
console.log('[BizScope] Build marker: auth-trace-2026-06-07. VITE_APP_URL=', import.meta.env.VITE_APP_URL, '| SUPABASE configured=', !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
