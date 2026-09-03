import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Network } from '@capacitor/network';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { toast } from 'sonner';
import { isCapacitor, isAndroid } from '../lib/platform';

type BackButtonHandler = () => boolean; // return true if handled

class MobileService {
  private initialized = false;
  private lastBackPressTime = 0;
  private backHandlers: BackButtonHandler[] = [];

  /**
   * Initialize native mobile integrations safely
   */
  async init(options?: { onNavigateBack?: () => void; isRootRoute?: () => boolean }) {
    if (!isCapacitor() || this.initialized) {
      return;
    }

    this.initialized = true;

    try {
      // 1. Setup Status Bar
      await this.setupStatusBar();
    } catch (err) {
      console.warn('Status bar setup warning:', err);
    }

    try {
      // 2. Hide Splash Screen cleanly
      await SplashScreen.hide({ fadeOutDuration: 300 });
    } catch (err) {
      console.warn('Splash screen hide warning:', err);
    }

    try {
      // 3. Setup Network Status Monitoring
      await this.setupNetworkListener();
    } catch (err) {
      console.warn('Network listener setup warning:', err);
    }

    try {
      // 4. Setup Android Hardware Back Button
      if (isAndroid()) {
        await this.setupBackButton(options);
      }
    } catch (err) {
      console.warn('Back button setup warning:', err);
    }
  }

  /**
   * Configure Native Status Bar
   */
  async setupStatusBar(theme: 'dark' | 'light' = 'dark') {
    if (!isCapacitor()) return;

    try {
      await StatusBar.setStyle({
        style: theme === 'dark' ? Style.Dark : Style.Light,
      });

      if (isAndroid()) {
        await StatusBar.setBackgroundColor({ color: '#164e63' });
        await StatusBar.setOverlaysWebView({ overlay: false });
      }
    } catch (e) {
      console.warn('Could not update status bar:', e);
    }
  }

  /**
   * Setup Android Hardware Back Button Handling
   */
  private async setupBackButton(options?: {
    onNavigateBack?: () => void;
    isRootRoute?: () => boolean;
  }) {
    await CapApp.addListener('backButton', ({ canGoBack }) => {
      // Priority 1: Check if any registered modal/popup handler wants to consume the event
      for (let i = this.backHandlers.length - 1; i >= 0; i--) {
        const handler = this.backHandlers[i];
        if (handler && handler()) {
          return;
        }
      }

      // Priority 2: Check if current route is root / dashboard
      const isRoot = options?.isRootRoute ? options.isRootRoute() : false;

      if (isRoot || !canGoBack) {
        const now = Date.now();
        if (now - this.lastBackPressTime < 2000) {
          CapApp.exitApp();
        } else {
          this.lastBackPressTime = now;
          toast.info('Press back again to exit BillingMaster');
        }
        return;
      }

      // Priority 3: Navigate backward in router history
      if (options?.onNavigateBack) {
        options.onNavigateBack();
      } else if (window.history.length > 1) {
        window.history.back();
      } else {
        const now = Date.now();
        if (now - this.lastBackPressTime < 2000) {
          CapApp.exitApp();
        } else {
          this.lastBackPressTime = now;
          toast.info('Press back again to exit BillingMaster');
        }
      }
    });
  }

  /**
   * Register a custom back button consumer (e.g. for modals or side drawers).
   * Returns an unregister function.
   */
  registerBackHandler(handler: BackButtonHandler): () => void {
    this.backHandlers.push(handler);
    return () => {
      const idx = this.backHandlers.indexOf(handler);
      if (idx !== -1) {
        this.backHandlers.splice(idx, 1);
      }
    };
  }

  /**
   * Network connection monitor
   */
  private async setupNetworkListener() {
    let wasOffline = false;

    Network.addListener('networkStatusChange', (status) => {
      if (!status.connected) {
        wasOffline = true;
        toast.warning('No internet connection. Operating in offline mode.');
      } else if (wasOffline) {
        wasOffline = false;
        toast.success('Internet connection restored.');
      }
    });
  }

  /**
   * Safe Haptic Feedback Trigger
   */
  async triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') {
    if (!isCapacitor()) return;

    try {
      if (type === 'light') {
        await Haptics.impact({ style: ImpactStyle.Light });
      } else if (type === 'medium') {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } else if (type === 'heavy') {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } else if (type === 'success') {
        await Haptics.notification({ type: NotificationType.Success });
      } else if (type === 'warning') {
        await Haptics.notification({ type: NotificationType.Warning });
      } else if (type === 'error') {
        await Haptics.notification({ type: NotificationType.Error });
      }
    } catch {
      // Haptics not available on current hardware
    }
  }
}

export const mobileService = new MobileService();
