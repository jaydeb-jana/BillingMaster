import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Prevent mouse wheel scrolling from altering input[type="number"] values globally
if (typeof window !== 'undefined') {
  window.addEventListener(
    'wheel',
    () => {
      if (document.activeElement && (document.activeElement as HTMLInputElement).type === 'number') {
        (document.activeElement as HTMLInputElement).blur();
      }
    },
    { passive: true }
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

