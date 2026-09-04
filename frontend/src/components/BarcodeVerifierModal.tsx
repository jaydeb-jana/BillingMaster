import { useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  ScanLine, 
  Camera, 
  Keyboard, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Package, 
  Sparkles, 
  Plus, 
  FileText, 
  Pencil, 
  RefreshCw, 
  Trash2, 
  Check, 
  ArrowRight,
  Barcode,
  Zap,
  ZapOff,
  ExternalLink
} from 'lucide-react';
import { db, getSupabaseErrorMessage, getProductBarcode, generateInternalSku } from '@/lib/api';
import { useLocation } from 'wouter';

type ProductRow = Record<string, any>;

interface BarcodeVerifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductRow[];
  targetProduct?: ProductRow | null;
  onReloadProducts: () => void;
  onOpenAddProductWithBarcode?: (barcode: string) => void;
  onEditProduct?: (product: ProductRow) => void;
  initialBarcode?: string;
}

function playScanBeep(type: 'success' | 'error' | 'delete' = 'success') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, ctx.currentTime);
      osc.frequency.setValueAtTime(1400, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } else if (type === 'delete') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(220, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      osc.frequency.setValueAtTime(180, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    }
  } catch (e) {
    // ignore audio error
  }
}

export function BarcodeVerifierModal({
  isOpen,
  onClose,
  products,
  targetProduct: initialTargetProduct,
  onReloadProducts,
  onOpenAddProductWithBarcode,
  onEditProduct,
  initialBarcode = '',
}: BarcodeVerifierModalProps) {
  const [, setLocation] = useLocation();
  const [targetProduct, setTargetProduct] = useState<ProductRow | null>(initialTargetProduct || null);
  const [activeTab, setActiveTab] = useState<'scan' | 'manual'>('scan');
  const [barcodeInput, setBarcodeInput] = useState(initialBarcode || '');
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [matchedProduct, setMatchedProduct] = useState<ProductRow | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorchSupport, setHasTorchSupport] = useState(false);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'barcode-modal-scanner-box';

  const [isChangingBarcode, setIsChangingBarcode] = useState(false);

  // Sync target product when prop changes or modal opens
  useEffect(() => {
    if (initialTargetProduct) {
      // Find latest updated row in products
      const latest = products.find((p) => p.id === initialTargetProduct.id) || initialTargetProduct;
      setTargetProduct(latest);
      const existingCode = getProductBarcode(latest);
      setBarcodeInput(existingCode);
    } else {
      setTargetProduct(null);
      setBarcodeInput(initialBarcode || '');
    }
    setScannedCode(null);
    setMatchedProduct(null);
    setHasSearched(false);
    setSuccessMessage(null);
    setConfirmingDelete(false);
    setIsChangingBarcode(false);
  }, [isOpen, initialTargetProduct, initialBarcode, products]);

  // Extract current product's existing barcode
  const currentProductBarcode = targetProduct ? getProductBarcode(targetProduct) : '';

  // Duplicate conflict detector: check if barcodeInput belongs to another product
  const duplicateConflictProduct = useMemo(() => {
    if (!targetProduct || !barcodeInput.trim()) return null;
    const clean = barcodeInput.trim().toLowerCase();
    return products.find(
      (p) => p.id !== targetProduct.id && getProductBarcode(p).toLowerCase() === clean
    ) || null;
  }, [products, targetProduct, barcodeInput]);

  // Product finder utility
  const findProductByCode = (code: string): ProductRow | null => {
    if (!code || !code.trim()) return null;
    const clean = code.trim().toLowerCase();
    
    // Direct match with user barcode
    let match = products.find((p) => {
      const b = getProductBarcode(p).toLowerCase();
      return b && b === clean;
    });
    if (match) return match;

    // Direct match with raw sku if entered
    match = products.find((p) => (p.sku && String(p.sku).trim().toLowerCase() === clean));
    if (match) return match;

    return null;
  };

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const html5ScannerRef = useRef<Html5Qrcode | null>(null);
  const isCameraCanceledRef = useRef(false);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Stop camera media stream and scanning loop
  const stopCamera = async () => {
    isCameraCanceledRef.current = true;
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (isTorchOn && streamRef.current) {
      try {
        const track = streamRef.current.getVideoTracks()[0];
        if (track) {
          await (track as any).applyConstraints({ advanced: [{ torch: false }] });
        }
      } catch (e) {}
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => {
          t.stop();
        });
      } catch (e) {}
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        if (videoRef.current.srcObject) {
          const srcStream = videoRef.current.srcObject as MediaStream;
          srcStream.getTracks?.().forEach((t) => t.stop());
        }
      } catch (e) {}
      videoRef.current.srcObject = null;
    }
    if (html5ScannerRef.current) {
      try {
        await html5ScannerRef.current.stop().catch(() => {});
        html5ScannerRef.current.clear();
      } catch (e) {}
      html5ScannerRef.current = null;
    }
    setIsCameraActive(false);
    setIsScanning(false);
    setIsTorchOn(false);
    setHasTorchSupport(false);
  };

  // Toggle camera flashlight (torch) and brightness boost
  const toggleTorch = async () => {
    const nextState = !isTorchOn;
    setIsTorchOn(nextState);

    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        try {
          await (track as any).applyConstraints({ advanced: [{ torch: nextState }] });
        } catch (err) {
          console.warn('Hardware torch error (using digital brightness boost):', err);
        }
      }
    }
  };

  // Handle successful code detection
  const handleCodeDetected = (detectedCode: string) => {
    const clean = detectedCode.trim();
    if (!clean) return;

    // Stop camera immediately
    void stopCamera();

    setBarcodeInput(clean);
    setScannedCode(clean);

    if (targetProduct) {
      const conflict = products.find(
        (p) => p.id !== targetProduct.id && getProductBarcode(p).toLowerCase() === clean.toLowerCase()
      );
      if (conflict) {
        playScanBeep('error');
      } else {
        playScanBeep('success');
      }
    } else {
      setHasSearched(true);
      const found = findProductByCode(clean);
      setMatchedProduct(found);
      if (found) {
        playScanBeep('success');
      } else {
        playScanBeep('error');
      }
    }
  };

  // Start Camera with multi-tiered fallback
  const startCamera = async () => {
    isCameraCanceledRef.current = false;
    await stopCamera();
    isCameraCanceledRef.current = false;
    setScannerError(null);
    setIsPermissionDenied(false);
    setIsScanning(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported on this browser.');
      }

      let stream: MediaStream | null = null;

      try {
        // Primary: back/environment camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
      } catch (e1) {
        try {
          // Secondary: any environment camera
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false
          });
        } catch (e2) {
          // Tertiary fallback: any available camera
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }

      if (!stream) {
        throw new Error('Unable to access camera');
      }

      if (isCameraCanceledRef.current || !isOpen) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      // Check flashlight/torch capability on track
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = typeof (videoTrack as any).getCapabilities === 'function' 
          ? (videoTrack as any).getCapabilities() 
          : {};
        if (capabilities && (capabilities.torch || 'torch' in capabilities)) {
          setHasTorchSupport(true);
        } else {
          setHasTorchSupport(true); // Allow toggle attempt on mobile
        }
      }

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setIsCameraActive(true);
      setIsScanning(true);

      // Step 2: Initialize detection engine
      // Check if native BarcodeDetector is available (Instant on Chrome Android)
      const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

      if (hasBarcodeDetector) {
        try {
          const supportedFormats = await (window as any).BarcodeDetector.getSupportedFormats();
          const detector = new (window as any).BarcodeDetector({
            formats: supportedFormats || [
              'ean_13',
              'ean_8',
              'code_128',
              'code_39',
              'upc_a',
              'upc_e',
              'qr_code',
              'data_matrix',
            ],
          });

          // Run high-speed scan loop on video element
          scanIntervalRef.current = window.setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const rawVal = barcodes[0].rawValue;
                if (rawVal) {
                  handleCodeDetected(rawVal);
                }
              }
            } catch (detectErr) {
              // frame decode error - continue
            }
          }, 90);
          return;
        } catch (e) {
          console.warn('BarcodeDetector init error, falling back to Html5Qrcode:', e);
        }
      }

      // Fallback: Use Html5Qrcode scanner engine
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const html5QrCode = new Html5Qrcode('barcode-modal-hidden-canvas-host', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
        verbose: false,
      });
      html5ScannerRef.current = html5QrCode;

      scanIntervalRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2 || !ctx) return;
        try {
          const v = videoRef.current;
          canvas.width = v.videoWidth || 640;
          canvas.height = v.videoHeight || 480;
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(async (blob) => {
            if (!blob || !html5ScannerRef.current) return;
            try {
              const file = new File([blob], 'frame.jpg', { type: 'image/jpeg' });
              const result = await html5ScannerRef.current.scanFile(file, false);
              if (result) {
                handleCodeDetected(result);
              }
            } catch (scanErr) {
              // frame decode failure - expected
            }
          }, 'image/jpeg', 0.85);
        } catch (e) {}
      }, 180);

    } catch (err: any) {
      console.error('Camera start error:', err);
      setIsCameraActive(false);
      setIsScanning(false);
      const msg = err?.message || String(err);
      const isDenied = msg.includes('NotAllowedError') || msg.includes('Permission') || msg.includes('denied');
      setIsPermissionDenied(isDenied);
      if (isDenied) {
        setScannerError('Camera permission is required. Please tap "Allow" or open the app in a new tab.');
      } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
        setScannerError('No camera found on this device. Please enter the barcode manually.');
      } else {
        setScannerError('Camera is currently unavailable. Please tap "Start Camera" or enter manually.');
      }
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'scan' && !scannedCode && (!targetProduct || !currentProductBarcode || isChangingBarcode)) {
      isCameraCanceledRef.current = false;
      const timer = setTimeout(() => {
        if (!isCameraCanceledRef.current && isOpen) {
          void startCamera();
        }
      }, 150);
      return () => {
        isCameraCanceledRef.current = true;
        clearTimeout(timer);
        void stopCamera();
      };
    } else {
      isCameraCanceledRef.current = true;
      void stopCamera();
      return undefined;
    }
  }, [isOpen, activeTab, scannedCode, targetProduct, currentProductBarcode, isChangingBarcode]);

  useEffect(() => {
    return () => {
      isCameraCanceledRef.current = true;
      void stopCamera();
    };
  }, []);

  // Action: Save / Confirm Barcode to Target Product
  const handleSaveBarcodeToTarget = async () => {
    if (!targetProduct || !barcodeInput.trim()) return;
    const cleanCode = barcodeInput.trim();

    // Check duplicate
    const conflict = products.find(
      (p) => p.id !== targetProduct.id && getProductBarcode(p).toLowerCase() === cleanCode.toLowerCase()
    );
    if (conflict) {
      playScanBeep('error');
      setSuccessMessage(`Cannot attach barcode: This barcode is already used by "${conflict.name}".`);
      return;
    }

    setIsSaving(true);
    setSuccessMessage(null);

    try {
      let meta: Record<string, any> = {};
      if (targetProduct.notes && (targetProduct.notes.startsWith('{') || targetProduct.notes.startsWith('['))) {
        try {
          meta = JSON.parse(targetProduct.notes);
        } catch (e) {}
      }
      meta.sku = cleanCode;
      meta.barcode = cleanCode;

      const payload = {
        sku: cleanCode,
        barcode: cleanCode,
        notes: JSON.stringify(meta),
      };

      await db.update('products', targetProduct.id, payload);
      const updated = { ...targetProduct, ...payload };
      setTargetProduct(updated);
      setSuccessMessage(`Barcode "${cleanCode}" saved successfully to "${targetProduct.name}"!`);
      playScanBeep('success');
      onReloadProducts();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Failed to save barcode:', err);
      setSuccessMessage('Failed to save barcode. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Action: Delete / Clear Barcode from Target Product
  const handleDeleteBarcode = async () => {
    if (!targetProduct) return;
    setIsDeleting(true);
    setSuccessMessage(null);

    try {
      const internalSku = generateInternalSku(targetProduct.id);
      let meta: Record<string, any> = {};
      if (targetProduct.notes && (targetProduct.notes.startsWith('{') || targetProduct.notes.startsWith('['))) {
        try {
          meta = JSON.parse(targetProduct.notes);
        } catch (e) {}
      }
      meta.sku = '';
      meta.barcode = '';

      const payload = {
        sku: internalSku,
        barcode: '',
        notes: JSON.stringify(meta),
      };

      await db.update('products', targetProduct.id, payload);
      const updated = { 
        ...targetProduct, 
        sku: internalSku, 
        barcode: '', 
        notes: JSON.stringify(meta) 
      };
      setTargetProduct(updated);
      setBarcodeInput('');
      setScannedCode(null);
      setConfirmingDelete(false);
      setSuccessMessage(`Barcode successfully removed from "${targetProduct.name}"!`);
      playScanBeep('delete');
      onReloadProducts();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Failed to delete barcode:', err);
      setSuccessMessage('Failed to remove barcode. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // General lookup verify action
  const handleGeneralVerify = () => {
    const clean = barcodeInput.trim();
    if (!clean) return;
    setHasSearched(true);
    const found = findProductByCode(clean);
    setMatchedProduct(found);
    if (found) {
      playScanBeep('success');
    } else {
      playScanBeep('error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-sidebar/60 backdrop-blur-xs p-0 sm:p-4 print:hidden animate-in fade-in-0 duration-200">
      <div className="w-full max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-float relative flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:px-6 sm:py-4 border-b border-border/70 bg-card shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <ScanLine size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-foreground tracking-tight truncate">
                {targetProduct ? `Barcode: ${targetProduct.name}` : 'Verify & Manage Barcode'}
              </h3>
              <p className="text-[11px] text-muted-foreground truncate font-medium">
                {targetProduct ? 'Scan or enter scannable barcode to attach' : 'Scan or enter barcode to lookup product'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0 cursor-pointer"
            title="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* Target Product Summary Box (Only shown when no barcode is set yet or when changing) */}
          {targetProduct && !currentProductBarcode && (
            <div className="rounded-2xl border border-border/80 bg-muted/30 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Package size={18} />
                  </div>
                  <div>
                    <div className="font-black text-foreground text-sm sm:text-base">{targetProduct.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Price: <span className="mono font-bold text-foreground">₹{Number(targetProduct.price || 0).toFixed(2)}</span>
                      {' • '}
                      Stock: <span className="mono font-bold text-foreground">{targetProduct.stock_quantity ?? 0}</span>
                    </div>
                  </div>
                </div>

                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                  No Barcode Set
                </span>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold animate-in fade-in-0">
              <CheckCircle2 size={16} className="shrink-0 stroke-[2.5]" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* If Target Product already has a Barcode attached: Show Single Clean Connected State with Delete and Close buttons */}
          {targetProduct && currentProductBarcode ? (
            <div className="space-y-4 pt-1">
              <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-4 animate-in fade-in-0">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={32} className="stroke-[2.5]" />
                </div>
                
                <div className="space-y-1">
                  <div className="text-sm font-extrabold text-foreground">
                    Barcode Successfully Connected!
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Product: <strong className="text-foreground">{targetProduct.name}</strong> (Price: ₹{Number(targetProduct.price || 0).toFixed(2)} • Stock: {targetProduct.stock_quantity ?? 0})
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    Linked Barcode:
                  </p>
                  <div className="inline-block mt-1 font-mono text-base font-black px-4 py-1.5 rounded-xl bg-card border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-2xs">
                    {currentProductBarcode}
                  </div>
                </div>

                {/* Delete Confirmation Box */}
                {confirmingDelete ? (
                  <div className="pt-3 border-t border-destructive/25 space-y-2 p-3.5 bg-destructive/10 rounded-xl border border-destructive/30 text-left animate-in fade-in-0">
                    <div className="text-xs font-bold text-destructive flex items-center gap-1.5">
                      <AlertTriangle size={15} className="shrink-0" />
                      <span>Are you sure you want to delete barcode ({currentProductBarcode}) from "{targetProduct.name}"?</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={handleDeleteBarcode}
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-extrabold text-white bg-destructive hover:bg-destructive/90 transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                      >
                        <Trash2 size={13} />
                        <span>{isDeleting ? 'Deleting…' : 'Yes, Delete Barcode'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => setConfirmingDelete(false)}
                        className="py-2 px-3 rounded-xl text-xs font-bold text-muted-foreground bg-muted hover:text-foreground hover:bg-muted/80 transition-all border border-border/60 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => setConfirmingDelete(true)}
                      className="py-2.5 px-3 rounded-xl text-xs font-bold bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Trash2 size={14} />
                      <span>Delete Barcode</span>
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="btn-primary py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <Check size={14} />
                      <span>Done / Close</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* If user clicked Change Barcode, show back button */}
              {targetProduct && currentProductBarcode && isChangingBarcode && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border text-xs">
                  <span className="text-muted-foreground font-medium">Changing barcode for <strong className="text-foreground">{targetProduct.name}</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangingBarcode(false);
                      setBarcodeInput(currentProductBarcode);
                    }}
                    className="font-bold text-primary hover:underline text-xs"
                  >
                    Cancel Change
                  </button>
                </div>
              )}

              {/* Mode Switcher Tabs */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 rounded-xl border border-border/60">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('scan');
                    setScannedCode(null);
                    setScannerError(null);
                  }}
                  className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'scan'
                      ? 'bg-card text-primary font-extrabold shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Camera size={15} />
                  <span>Camera Scan</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('manual');
                    void stopCamera();
                  }}
                  className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'manual'
                      ? 'bg-card text-primary font-extrabold shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Keyboard size={15} />
                  <span>Type Barcode</span>
                </button>
              </div>

              {/* 1. Camera View */}
              {activeTab === 'scan' && (
                <div className="space-y-3">
                  {/* Hidden container for fallback scanner engine */}
                  <div id="barcode-modal-hidden-canvas-host" className="hidden" />

                  {scannedCode ? (
                    /* SUCCESS DETECTION SCREEN (Camera stopped, number auto-placed, Cancel & Rescan button) */
                    <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-5 text-center space-y-3.5 animate-in zoom-in-95">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={28} className="stroke-[2.5]" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-extrabold text-foreground">
                          Barcode Detected Successfully!
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Scanned Code:
                        </p>
                        <div className="inline-block mt-1 font-mono text-base font-black px-4 py-1.5 rounded-xl bg-card border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-2xs">
                          {scannedCode}
                        </div>
                      </div>

                      <div className="pt-1 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            setScannedCode(null);
                            setBarcodeInput('');
                            void startCamera();
                          }}
                          className="py-2.5 px-4 rounded-xl text-xs font-extrabold bg-muted/90 hover:bg-muted text-foreground border border-border transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-2xs"
                        >
                          <X size={14} className="text-destructive" />
                          <span>Cancel & Rescan</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* LIVE CAMERA SCANNER */
                    <div className="relative overflow-hidden rounded-2xl border-2 border-primary/30 bg-black aspect-4/3 flex flex-col items-center justify-center shadow-inner">
                      <video
                        ref={videoRef}
                        playsInline
                        autoPlay
                        muted
                        className={`w-full h-full object-cover transition-all duration-300 ${
                          isTorchOn ? 'brightness-125 contrast-110' : ''
                        }`}
                      />

                      {/* ALWAYS VISIBLE FLASHLIGHT / TORCH TOGGLE */}
                      <button
                        type="button"
                        onClick={toggleTorch}
                        className={`absolute top-3 right-3 z-30 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black shadow-lg backdrop-blur-md transition-all active:scale-90 border cursor-pointer ${
                          isTorchOn
                            ? 'bg-amber-400 text-black border-amber-300 shadow-amber-500/50 ring-2 ring-amber-400/40'
                            : 'bg-black/65 text-white border-white/25 hover:bg-black/85'
                        }`}
                        title="Toggle Flashlight / Light Boost"
                      >
                        {isTorchOn ? (
                          <Zap size={16} className="fill-black text-black animate-pulse" />
                        ) : (
                          <Zap size={16} className="text-amber-300" />
                        )}
                        <span>{isTorchOn ? 'Flash ON' : 'Flashlight'}</span>
                      </button>

                      {isCameraActive && (
                        <>
                          <div className="pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_14px_#f97316] animate-pulse" />
                          <div className="pointer-events-none absolute inset-x-10 inset-y-6 border-2 border-dashed border-primary/70 rounded-xl flex items-center justify-center">
                            <span className="bg-black/65 backdrop-blur-xs text-white text-[11px] font-bold px-3 py-1 rounded-full border border-white/15 shadow-sm">
                              Align Barcode in Viewfinder
                            </span>
                          </div>
                        </>
                      )}

                      {!isCameraActive && !scannerError && (
                        <div className="p-4 text-center text-xs text-white/80 space-y-2.5 absolute inset-0 flex flex-col items-center justify-center bg-black/70">
                          <RefreshCw size={24} className="text-primary animate-spin mx-auto" />
                          <p className="font-semibold">Starting camera scanner…</p>
                        </div>
                      )}

                      {scannerError && (
                        <div className="p-4 text-center text-xs text-white/95 space-y-2.5 bg-black/92 absolute inset-0 flex flex-col items-center justify-center animate-in fade-in-0">
                          <AlertTriangle size={26} className="text-amber-400 mx-auto shrink-0" />
                          <p className="max-w-xs leading-relaxed font-medium">{scannerError}</p>
                          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                            {isPermissionDenied ? (
                              <>
                                <a
                                  href={window.location.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-primary text-xs font-black px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-sm"
                                >
                                  <ExternalLink size={13} />
                                  <span>Open in New Tab</span>
                                </a>
                                <button
                                  type="button"
                                  onClick={() => void startCamera()}
                                  className="bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-semibold px-3 py-2 rounded-xl transition-all"
                                >
                                  Try Again
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void startCamera()}
                                className="btn-primary text-xs font-extrabold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
                              >
                                <RefreshCw size={13} />
                                <span>Start Camera</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                stopCamera();
                                setActiveTab('manual');
                              }}
                              className="bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-semibold px-3 py-2 rounded-xl transition-all"
                            >
                              Type Manually
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!scannedCode && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-1 pt-1">
                      <span>Auto-scans 1D barcodes and QR codes</span>
                      <div className="flex items-center gap-3">
                        {isCameraActive && (
                          <button
                            type="button"
                            onClick={toggleTorch}
                            className={`inline-flex items-center gap-1 font-bold transition-all cursor-pointer ${
                              isTorchOn ? 'text-amber-500 font-extrabold' : 'text-foreground/80 hover:text-foreground'
                            }`}
                          >
                            {isTorchOn ? (
                              <Zap size={13} className="fill-amber-500 text-amber-500" />
                            ) : (
                              <ZapOff size={13} />
                            )}
                            <span>{isTorchOn ? 'Flashlight: ON' : 'Flashlight: OFF'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setScannedCode(null);
                            void startCamera();
                          }}
                          className="inline-flex items-center gap-1 font-bold text-primary hover:underline cursor-pointer"
                        >
                          <RefreshCw size={12} />
                          <span>Restart</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Barcode Input Field & Confirmation */}
              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-extrabold text-foreground">
                      Barcode Number / SKU
                    </label>
                    {scannedCode && (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check size={12} /> Scanned from Camera
                      </span>
                    )}
                  </div>
                  
                  <div className="relative">
                    <input
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (targetProduct) {
                            if (!duplicateConflictProduct) {
                              void handleSaveBarcodeToTarget();
                            }
                          } else {
                            handleGeneralVerify();
                          }
                        }
                      }}
                      placeholder="e.g. 8901234567890 (Scan or enter barcode)"
                      className={`input-shell w-full pl-3.5 pr-10 py-2.5 text-sm font-semibold tracking-wide ${
                        duplicateConflictProduct ? 'border-rose-500 ring-1 ring-rose-500/40 bg-rose-500/5' : ''
                      }`}
                    />
                    {barcodeInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setBarcodeInput('');
                          setScannedCode(null);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-md"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* DUPLICATE BARCODE CONFLICT WARNING */}
                {duplicateConflictProduct && (
                  <div className="rounded-2xl border-2 border-rose-500/40 bg-rose-500/10 p-4 space-y-2 text-rose-700 dark:text-rose-300 animate-in fade-in-0 slide-in-from-top-1">
                    <div className="flex items-center gap-2 font-extrabold text-xs text-rose-600 dark:text-rose-400">
                      <AlertTriangle size={17} className="shrink-0 text-rose-500" />
                      <span>Barcode Already in Use!</span>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed">
                      This barcode (<strong className="mono font-black">{barcodeInput.trim()}</strong>) is already assigned to product <strong className="text-foreground font-black">"{duplicateConflictProduct.name}"</strong> (Price: ₹{Number(duplicateConflictProduct.price || 0).toFixed(2)} • Stock: {duplicateConflictProduct.stock_quantity ?? 0}).
                    </p>
                    <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                      Duplicate barcodes are not allowed. Please enter or scan a unique barcode for "{targetProduct?.name || 'this product'}".
                    </p>
                  </div>
                )}

                {/* CONFIRM & SAVE BUTTON (If Target Product is Selected) */}
                {targetProduct && (
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={!barcodeInput.trim() || isSaving || barcodeInput.trim() === currentProductBarcode || !!duplicateConflictProduct}
                      onClick={handleSaveBarcodeToTarget}
                      className="btn-primary w-full py-3 text-sm font-extrabold rounded-xl flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
                    >
                      <CheckCircle2 size={18} />
                      <span>
                        {isSaving 
                          ? 'Saving to Product…' 
                          : duplicateConflictProduct
                            ? 'Barcode Already In Use'
                            : 'Confirm & Save Barcode'
                        }
                      </span>
                    </button>
                  </div>
                )}

                {/* GENERAL VERIFY BUTTON (If opened from main top button) */}
                {!targetProduct && (
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={!barcodeInput.trim()}
                      onClick={handleGeneralVerify}
                      className="btn-primary w-full py-2.5 text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      <ScanLine size={16} />
                      <span>Verify Barcode</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 3. Lookup Results (Only for General Mode) */}
          {!targetProduct && hasSearched && (
            <div className="pt-2">
              {matchedProduct ? (
                <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                      <CheckCircle2 size={18} />
                      <span>Product Found</span>
                    </div>
                    <span className="mono text-xs font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md">
                      {matchedProduct.sku || barcodeInput}
                    </span>
                  </div>

                  <div className="bg-card p-3 rounded-xl border border-border/80 flex items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Package size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-foreground text-sm">{matchedProduct.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Price: <span className="mono font-bold text-foreground">₹{Number(matchedProduct.price || 0).toFixed(2)}</span>
                        {' • '}
                        Stock: <span className="mono font-bold text-foreground">{matchedProduct.stock_quantity ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        setLocation('/invoices/new');
                      }}
                      className="py-2.5 px-3 text-xs font-extrabold rounded-xl border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-all flex items-center justify-center gap-1.5"
                    >
                      <FileText size={14} />
                      <span>New Invoice</span>
                    </button>
                    {onEditProduct && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onEditProduct(matchedProduct);
                        }}
                        className="py-2.5 px-3 text-xs font-extrabold rounded-xl border border-border bg-muted/60 hover:bg-muted text-foreground transition-all flex items-center justify-center gap-1.5"
                      >
                        <Pencil size={14} />
                        <span>Edit Product</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-extrabold text-sm">
                    <AlertTriangle size={18} />
                    <span>Barcode Not Found</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No product is currently registered with barcode <span className="mono font-bold text-foreground">{barcodeInput}</span>.
                  </p>
                  {onOpenAddProductWithBarcode && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAddProductWithBarcode(barcodeInput.trim());
                      }}
                      className="btn-primary w-full py-2.5 text-xs font-extrabold rounded-xl flex items-center justify-center gap-2"
                    >
                      <Plus size={15} />
                      <span>Create New Product with this Barcode</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
