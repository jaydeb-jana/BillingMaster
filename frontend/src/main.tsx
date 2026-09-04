import { createRoot } from 'react-dom/client';

import { SplashScreen } from '@capacitor/splash-screen';
import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

// Immediate failsafe to ensure Android splash overlay is never stuck
if (typeof window !== 'undefined') {
  void SplashScreen.hide().catch(() => {});
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
