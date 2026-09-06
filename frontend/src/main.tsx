import { createRoot } from 'react-dom/client';

import { SplashScreen } from '@capacitor/splash-screen';
import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

// Immediate failsafe to ensure Android splash overlay is never stuck
if (typeof window !== 'undefined') {
  void SplashScreen.hide().catch(() => {});
  
  // Prevent mouse wheel scrolling from altering input[type="number"] values globally
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


createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
