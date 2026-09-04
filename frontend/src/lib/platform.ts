import { Capacitor } from '@capacitor/core';

export type PlatformType = 'android' | 'ios' | 'electron' | 'web';

/**
 * Checks if running inside native Capacitor environment (Android or iOS)
 */
export function isCapacitor(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}

/**
 * Checks if running specifically on Android via Capacitor
 */
export function isAndroid(): boolean {
  return typeof window !== 'undefined' && Capacitor.getPlatform() === 'android';
}

/**
 * Checks if running specifically on iOS via Capacitor
 */
export function isIOS(): boolean {
  return typeof window !== 'undefined' && Capacitor.getPlatform() === 'ios';
}

/**
 * Checks if running inside Desktop Electron app
 */
export function isElectron(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean((window as any).electronAPI?.isElectron)
  );
}

/**
 * Checks if running in desktop Electron, native mobile (Capacitor), or file protocol
 */
export function isDesktopOrFile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'file:' || isElectron() || isCapacitor();
}

/**
 * Checks if running in standard web browser
 */
export function isWeb(): boolean {
  return !isCapacitor() && !isElectron();
}

/**
 * Returns current platform name
 */
export function getPlatformName(): PlatformType {
  if (isAndroid()) return 'android';
  if (isIOS()) return 'ios';
  if (isElectron()) return 'electron';
  return 'web';
}

/**
 * Returns platform display label
 */
export function getPlatformDisplayLabel(): string {
  switch (getPlatformName()) {
    case 'android':
      return 'Android Mobile';
    case 'ios':
      return 'iOS Mobile';
    case 'electron':
      return 'Desktop Application';
    case 'web':
    default:
      return 'Web Browser';
  }
}
