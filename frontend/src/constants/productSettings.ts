export interface ProductHardwareSettings {
  scannerMode: 'phone_camera' | 'pc_webcam' | 'usb_machine';
  selectedDeviceId: string;
  soundBeepEnabled: boolean;
  continuousScan: boolean;
  autoSubmitScannerKey: boolean;
  defaultUnit: string;
  barcodePrefix: string;
  defaultReturnDays: number;
  lowStockThreshold: number;
  defaultItemType: 'physical' | 'service';
}

export const DEFAULT_PRODUCT_SETTINGS: ProductHardwareSettings = {
  scannerMode: 'phone_camera',
  selectedDeviceId: '',
  soundBeepEnabled: true,
  continuousScan: false,
  autoSubmitScannerKey: true,
  defaultUnit: 'pcs',
  barcodePrefix: 'PRD-',
  defaultReturnDays: 7,
  lowStockThreshold: 5,
  defaultItemType: 'physical',
};

const SETTINGS_KEY = 'billingmaster_product_settings';

export function getStoredProductSettings(): ProductHardwareSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_PRODUCT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to parse stored product settings:', e);
  }
  return DEFAULT_PRODUCT_SETTINGS;
}

export function saveProductSettings(settings: ProductHardwareSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save product settings:', e);
  }
}
