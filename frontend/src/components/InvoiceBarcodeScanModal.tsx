import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  ScanLine, 
  Camera, 
  Keyboard, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Package, 
  Plus, 
  Minus,
  Search, 
  Zap, 
  ZapOff, 
  RotateCcw,
  ShoppingBag,
  ArrowRight,
  Check,
  AlertTriangle,
  Trash2,
  Tag
} from 'lucide-react';
import { toast } from 'sonner';
import { getProductBarcode, getProductUniqueId } from '@/lib/api';
import { getStoredProductSettings } from '@/constants/productSettings';
import { useBodyScrollLock } from '@/lib/useScrollReset';
import { safeStopHtml5Qrcode, stopAllVideoElementStreams } from '@/lib/camera';

type ProductRow = Record<string, any>;

interface InvoiceBarcodeScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductRow[];
  onAddProduct: (product: ProductRow, forceAllow?: boolean) => boolean | void;
  onUpdateQuantity?: (productId: string | number, delta: number) => void;
  onRemoveItem?: (productId: string | number) => void;
  items: ProductRow[];
}

function playScanBeep(type: 'success' | 'error' = 'success') {
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
      osc.frequency.setValueAtTime(950, ctx.currentTime);
      osc.frequency.setValueAtTime(1450, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      osc.frequency.setValueAtTime(160, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.26);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
    }
  } catch {
    // audio permission or context not allowed
  }
}

export const InvoiceBarcodeScanModal: React.FC<InvoiceBarcodeScanModalProps> = ({
  isOpen,
  onClose,
  products,
  onAddProduct,
  onUpdateQuantity,
  onRemoveItem,
  items,
}) => {
  useBodyScrollLock(isOpen);
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [manualInput, setManualInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [cameraError, setCameraError] = useState('');
  
  // Continuous scanning mode: auto keeps camera scanning for rapid POS billing
  const [continuousScan, setContinuousScan] = useState(() => {
    return getStoredProductSettings().continuousScan ?? true;
  });

  // Track the most recently added product and scan feedback
  const [lastAddedProductId, setLastAddedProductId] = useState<string | number | null>(null);
  const [recentNotification, setRecentNotification] = useState<{ name: string; price: number | string; time: number } | null>(null);
  const [zeroStockPromptProduct, setZeroStockPromptProduct] = useState<ProductRow | null>(null);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const isCancelledRef = useRef(false);
  const scannerContainerId = 'invoice-barcode-scanner-viewfinder';

  // Calculate invoice items summary inside the modal
  const totalItemCount = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
  }, [items]);

  const totalItemAmount = useMemo(() => {
    return items.reduce((acc, it) => {
      const p = Number(it.price) || 0;
      const q = Number(it.quantity) || 1;
      return acc + p * q;
    }, 0);
  }, [items]);

  // Display items in reverse order so the newest added item appears at the top
  const displayedItems = useMemo(() => {
    return [...items].reverse();
  }, [items]);

  useEffect(() => {
    if (!isOpen) {
      isCancelledRef.current = true;
      void stopScanner();
      setManualInput('');
      setRecentNotification(null);
      setNotFoundBarcode(null);
      setZeroStockPromptProduct(null);
    } else {
      isCancelledRef.current = false;
      setActiveTab('camera');
      setNotFoundBarcode(null);
      setZeroStockPromptProduct(null);
    }
  }, [isOpen]);

  useEffect(() => {
    let timer: any = null;
    if (isOpen && activeTab === 'camera') {
      isCancelledRef.current = false;
      timer = setTimeout(() => {
        if (!isCancelledRef.current && isOpen) {
          void startScanner();
        }
      }, 250);
    } else {
      void stopScanner();
    }
    return () => {
      isCancelledRef.current = true;
      if (timer) clearTimeout(timer);
      void stopScanner();
    };
  }, [isOpen, activeTab]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      void stopScanner();
    };
  }, []);

  const stopScanner = async () => {
    isCancelledRef.current = true;
    setIsScanning(false);
    setTorchOn(false);

    if (html5QrcodeRef.current) {
      const instance = html5QrcodeRef.current;
      html5QrcodeRef.current = null;
      await safeStopHtml5Qrcode(instance, scannerContainerId);
    }
    stopAllVideoElementStreams(scannerContainerId);
  };

  const startScanner = async () => {
    setCameraError('');
    isCancelledRef.current = false;
    await stopScanner();
    isCancelledRef.current = false;

    if (!isOpen || activeTab !== 'camera') return;

    const element = document.getElementById(scannerContainerId);
    if (!element) return;

    try {
      const hwSettings = getStoredProductSettings();
      const instance = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF,
        ],
        verbose: false
      });
      html5QrcodeRef.current = instance;

      const config = {
        fps: 15,
        qrbox: { width: 250, height: 140 },
        aspectRatio: 1.777778,
      };

      const cameraParam = hwSettings.selectedDeviceId 
        ? { deviceId: { exact: hwSettings.selectedDeviceId } }
        : { facingMode: 'environment' };

      await instance.start(
        cameraParam,
        config,
        (decodedText) => {
          handleScannedBarcode(decodedText);
        },
        () => {
          // scanning frame callback
        }
      );

      // Check if modal was closed while camera was starting
      if (isCancelledRef.current || !isOpen || activeTab !== 'camera') {
        await safeStopHtml5Qrcode(instance, scannerContainerId);
        stopAllVideoElementStreams(scannerContainerId);
        html5QrcodeRef.current = null;
        setIsScanning(false);
        return;
      }

      setIsScanning(true);

      // Check torch capabilities
      try {
        const capabilities: any = instance.getRunningTrackCapabilities();
        if (capabilities && capabilities.torch) {
          setTorchSupported(true);
        }
      } catch {
        setTorchSupported(false);
      }
    } catch (err: any) {
      console.error('Camera start error:', err);
      setIsScanning(false);
      setCameraError(err?.message || 'Unable to access camera sensor. Please check camera permissions in browser.');
    }
  };

  const toggleTorch = async () => {
    if (html5QrcodeRef.current && torchSupported) {
      try {
        const nextState = !torchOn;
        await html5QrcodeRef.current.applyVideoConstraints({
          advanced: [{ torch: nextState }] as any
        });
        setTorchOn(nextState);
      } catch {
        toast.error('Torch light toggle not supported on this device.');
      }
    }
  };

  const findProductByCode = (code: string): ProductRow | undefined => {
    const clean = code.trim().toLowerCase();
    if (!clean) return undefined;

    // 1. Exact match on barcode, SKU, ID, or unique code
    const exact = products.find(p => {
      const pBarcode = (getProductBarcode(p) || '').toLowerCase();
      const pId = (getProductUniqueId(p) || '').toLowerCase();
      const pSku = (p.sku || '').toLowerCase();
      const rawId = String(p.id || '').toLowerCase();
      return pBarcode === clean || pId === clean || pSku === clean || rawId === clean;
    });
    if (exact) return exact;

    // 2. Exact match on product name
    const exactName = products.find(p => (p.name || '').toLowerCase() === clean);
    if (exactName) return exactName;

    // 3. Substring match on product name or barcode (e.g. typing "Aashirvaad" or partial barcode)
    return products.find(p => {
      const pName = (p.name || '').toLowerCase();
      const pBarcode = (getProductBarcode(p) || '').toLowerCase();
      const pSku = (p.sku || '').toLowerCase();
      return pName.includes(clean) || pBarcode.includes(clean) || pSku.includes(clean);
    });
  };

  const handleScannedBarcode = (code: string) => {
    const clean = code.trim();
    if (!clean) return;

    // Debounce duplicate scans of the exact same code within 1.5 seconds
    const now = Date.now();
    if (lastScannedRef.current.code === clean && now - lastScannedRef.current.time < 1500) {
      return;
    }
    lastScannedRef.current = { code: clean, time: now };

    executeProductAddition(clean);
  };

  const executeProductAddition = (code: string) => {
    const matched = findProductByCode(code);
    const hwSettings = getStoredProductSettings();

    if (!matched) {
      if (hwSettings.soundBeepEnabled) playScanBeep('error');
      setNotFoundBarcode(code);
      setZeroStockPromptProduct(null);
      toast.warning(`No product found with code "${code}"`);
      return;
    }

    setNotFoundBarcode(null);

    // Check zero stock
    const isService = matched.type === 'service' || matched.item_type === 'service' || matched.unit === 'service';
    const stockVal = Number(matched.stock_quantity ?? matched.stock ?? 0);
    const isZeroStock = !isService && stockVal <= 0;

    if (isZeroStock) {
      if (hwSettings.soundBeepEnabled) playScanBeep('error');
      setZeroStockPromptProduct(matched);
      toast.error(`Out of Stock! "${matched.name}" has 0 remaining stock.`);
      return;
    }

    // Add to invoice!
    commitAddProduct(matched, false);
  };

  const commitAddProduct = (product: ProductRow, forceAllow: boolean = false) => {
    const hwSettings = getStoredProductSettings();
    if (hwSettings.soundBeepEnabled) playScanBeep('success');

    onAddProduct(product, forceAllow);
    setLastAddedProductId(product.id);
    setZeroStockPromptProduct(null);
    setNotFoundBarcode(null);

    setRecentNotification({
      name: product.name,
      price: product.price ?? product.selling_price ?? 0,
      time: Date.now()
    });

    toast.success(`Added "${product.name}" to invoice!`);

    // If single scan mode (continuousScan is false), stop camera
    if (!continuousScan) {
      void stopScanner();
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) {
      toast.warning('Please enter or scan a barcode or SKU.');
      return;
    }
    executeProductAddition(manualInput);
    setManualInput('');
  };

  const handleCloseModal = async () => {
    await stopScanner();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/75 backdrop-blur-md p-3 sm:p-5 print:hidden animate-in fade-in-0 duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) void handleCloseModal(); }}
    >
      <div className="flex flex-col w-full max-w-xl max-h-[92dvh] rounded-3xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/80 bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shadow-2xs">
              <ScanLine size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-foreground tracking-tight">Scan Barcode to Add Item</h3>
                <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                  POS Scanner
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Scan barcodes to automatically add products to invoice</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => void handleCloseModal()}
            className="rounded-xl p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
            data-testid="button-close-invoice-scanner"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mode Selector Tabs & Continuous Toggle */}
        <div className="flex items-center justify-between border-b border-border/80 bg-background px-4 shrink-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className={`flex items-center gap-2 py-2.5 px-3 text-xs font-black border-b-2 transition-all cursor-pointer ${
                activeTab === 'camera'
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Camera size={15} />
              <span>Camera Scanner</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`flex items-center gap-2 py-2.5 px-3 text-xs font-black border-b-2 transition-all cursor-pointer ${
                activeTab === 'manual'
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Keyboard size={15} />
              <span>USB / Type Barcode</span>
            </button>
          </div>

          {/* Continuous Scan Mode Switch */}
          {activeTab === 'camera' && (
            <label 
              className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-muted-foreground hover:text-foreground select-none pr-1"
              title="When ON, keep camera scanning continuously for multiple products"
            >
              <input 
                type="checkbox"
                checked={continuousScan}
                onChange={(e) => setContinuousScan(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border text-primary accent-primary cursor-pointer"
              />
              <span className={continuousScan ? 'text-primary font-black' : ''}>
                Continuous {continuousScan && '✓'}
              </span>
            </label>
          )}
        </div>

        {/* Content Body: Scrollable */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1 custom-scrollbar">

          {/* TAB 1: CAMERA SCANNER */}
          {activeTab === 'camera' && (
            <div className="space-y-2">
              <div className="relative rounded-2xl overflow-hidden border border-border bg-black min-h-[175px] max-h-[195px] flex items-center justify-center shadow-inner">
                <div id={scannerContainerId} className="w-full h-full" />

                {/* Torch Toggle Button */}
                {torchSupported && isScanning && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`absolute top-2.5 right-2.5 px-2.5 py-1 rounded-xl text-[11px] font-extrabold flex items-center gap-1 shadow-md transition-all cursor-pointer ${
                      torchOn ? 'bg-amber-500 text-white' : 'bg-background/80 text-foreground backdrop-blur-xs hover:bg-background'
                    }`}
                  >
                    {torchOn ? <Zap size={13} /> : <ZapOff size={13} />}
                    <span>{torchOn ? 'Flash ON' : 'Flashlight'}</span>
                  </button>
                )}

                {/* Continuous Scan Indicator */}
                {isScanning && continuousScan && (
                  <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-500/90 text-white backdrop-blur-xs shadow-md flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    <span>Auto-Add Active</span>
                  </div>
                )}

                {/* Camera error message */}
                {cameraError && (
                  <div className="p-4 text-center text-white space-y-2 max-w-xs">
                    <AlertCircle size={26} className="mx-auto text-amber-400" />
                    <p className="text-xs font-semibold leading-relaxed">{cameraError}</p>
                    <button
                      type="button"
                      onClick={startScanner}
                      className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                    >
                      Retry Camera
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold px-1">
                <span>Hold product barcode in front of camera to scan</span>
                {isScanning ? (
                  <button
                    type="button"
                    onClick={startScanner}
                    className="text-primary hover:underline flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <RotateCcw size={12} />
                    <span>Restart Camera</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startScanner}
                    className="text-primary hover:underline flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <Camera size={12} />
                    <span>Start Camera</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MANUAL / USB SCANNER */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-2.5">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-foreground">
                  Barcode Number, SKU or Product Name
                </label>
                <div className="relative">
                  <ScanLine size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Scan with USB barcode gun or enter code/name…"
                    className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-2 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-2xs"
                    autoFocus
                    data-testid="input-manual-barcode-invoice"
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Compatible with physical USB laser barcode guns (scanners automatically send Enter).
                </p>
              </div>

              <button
                type="submit"
                className="w-full btn-primary rounded-xl py-2 text-xs font-black shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} />
                <span>Find & Add to Invoice</span>
              </button>
            </form>
          )}

          {/* FLASH NOTIFICATION BANNER (When item added) */}
          {recentNotification && (
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 flex items-center justify-between animate-in fade-in-0 duration-200 shadow-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-500 text-white shrink-0">
                  <Check size={14} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black truncate">Added: {recentNotification.name}</div>
                  <div className="text-[10px] font-bold opacity-80">₹{Number(recentNotification.price).toFixed(2)} added to line items</div>
                </div>
              </div>
              <span className="text-[9px] font-extrabold uppercase bg-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                Success
              </span>
            </div>
          )}

          {/* ZERO STOCK PROMPT MODAL INLINE */}
          {zeroStockPromptProduct && (
            <div className="p-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 space-y-2 animate-in fade-in-0 duration-200">
              <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200">
                <AlertTriangle size={17} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div>
                  <h4 className="text-xs font-black">Out of Stock Warning</h4>
                  <p className="text-[11px] mt-0.5 leading-relaxed">
                    Product <strong className="font-extrabold">"{zeroStockPromptProduct.name}"</strong> has <strong className="text-destructive">0 stock</strong> in inventory.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setZeroStockPromptProduct(null)}
                  className="flex-1 py-1.5 rounded-xl border border-border bg-card text-foreground text-xs font-bold hover:bg-muted cursor-pointer"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => commitAddProduct(zeroStockPromptProduct, true)}
                  className="flex-1 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Add Anyway</span>
                </button>
              </div>
            </div>
          )}

          {/* NOT FOUND ERROR BANNER */}
          {notFoundBarcode && (
            <div className="p-3 rounded-2xl border border-destructive/30 bg-destructive/10 space-y-1 animate-in fade-in-0 duration-200">
              <div className="flex items-start gap-2 text-destructive">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black">Barcode Not Found</h4>
                  <p className="text-[11px] mt-0.5 leading-relaxed opacity-90">
                    No product found with code <span className="mono font-bold">"{notFoundBarcode}"</span>. Check barcode in Products inventory.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SCANNED & ADDED PRODUCTS LIST (Displays all scanned products and pricing details) */}
          {/* ========================================================================= */}
          <div className="pt-2 border-t border-border/80 space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <ShoppingBag size={14} className="text-primary" />
                <span className="text-xs font-extrabold text-foreground">
                  Added Products in Invoice ({items.length})
                </span>
              </div>
              {items.length > 0 && (
                <span className="text-xs font-black text-primary">
                  Subtotal: ₹{totalItemAmount.toFixed(2)}
                </span>
              )}
            </div>

            {/* EMPTY STATE */}
            {items.length === 0 ? (
              <div className="py-5 px-4 text-center rounded-2xl border border-dashed border-border/80 bg-muted/10 space-y-1.5">
                <div className="mx-auto grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                  <ScanLine size={16} />
                </div>
                <div className="text-xs font-bold text-foreground">No Items Scanned Yet</div>
                <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                  Hold product barcode in front of the camera or enter barcode above. Scanned items with full details and price will appear here.
                </p>
              </div>
            ) : (
              /* LIST OF ADDED ITEMS DISPLAYED ONE BELOW ANOTHER */
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1" data-testid="scanned-items-list">
                {displayedItems.map((item, idx) => {
                  const pId = item.product_id ?? item.id;
                  const fullProduct = products.find(p => p.id === pId);
                  const barcode = fullProduct ? getProductBarcode(fullProduct) : '';
                  const imageUrl = fullProduct?.image_url;
                  const unitLabel = item.unit || fullProduct?.unit || 'unit';
                  const itemPrice = Number(item.price ?? fullProduct?.price ?? 0);
                  const itemQty = Number(item.quantity || 1);
                  const lineTotal = itemPrice * itemQty;
                  const isJustAdded = lastAddedProductId && (lastAddedProductId === pId);

                  return (
                    <div 
                      key={`${pId}-${idx}`}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isJustAdded 
                          ? 'border-emerald-500/50 bg-emerald-500/5 shadow-2xs' 
                          : 'border-border bg-card hover:border-border/80'
                      }`}
                      data-testid={`scanned-item-row-${pId}`}
                    >
                      {/* Left: Thumbnail & Details */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {imageUrl ? (
                          <img 
                            src={imageUrl} 
                            alt={item.name} 
                            className="h-10 w-10 rounded-xl object-cover border border-border shrink-0 bg-muted" 
                          />
                        ) : (
                          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary font-bold shrink-0">
                            <Package size={18} />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-extrabold text-foreground truncate max-w-[200px] sm:max-w-[240px]">
                              {item.name}
                            </span>
                            {isJustAdded && (
                              <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded-full">
                                Just Added ✓
                              </span>
                            )}
                          </div>

                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                            {/* Unit Rate */}
                            <span className="font-bold text-foreground">
                              ₹{itemPrice.toFixed(2)} <span className="font-normal text-muted-foreground">/ {unitLabel}</span>
                            </span>

                            {/* Barcode badge */}
                            {barcode && (
                              <span className="mono text-[10px] font-medium bg-muted px-1.5 py-0.2 rounded border border-border/60">
                                {barcode}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Quantity Stepper & Line Total */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        {/* Stepper */}
                        {onUpdateQuantity && (
                          <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 border border-border shadow-2xs">
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(pId, -1)}
                              className="h-6 w-6 grid place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                              title="Decrease quantity"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="mono text-xs font-black min-w-5 text-center">
                              {itemQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(pId, 1)}
                              className="h-6 w-6 grid place-items-center rounded-lg hover:bg-muted text-primary cursor-pointer transition-colors"
                              title="Increase quantity"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        )}

                        {/* Line Total */}
                        <div className="text-right min-w-[70px]">
                          <div className="text-xs font-black text-foreground">
                            ₹{lineTotal.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            ({itemQty} × ₹{itemPrice.toFixed(0)})
                          </div>
                        </div>

                        {/* Remove trash button */}
                        {onRemoveItem && (
                          <button
                            type="button"
                            onClick={() => onRemoveItem(pId)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            title="Remove item from invoice"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer / Summary Action Bar */}
        <div className="p-3.5 sm:p-4 border-t border-border/80 bg-muted/20 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary font-bold shrink-0">
              <ShoppingBag size={16} />
            </div>
            <div className="text-left min-w-0">
              <div className="text-xs font-black text-foreground">
                {totalItemCount} Total Item{totalItemCount === 1 ? '' : 's'} ({items.length} Product{items.length === 1 ? '' : 's'})
              </div>
              <div className="text-[11px] font-bold text-muted-foreground">
                Total: <span className="text-primary font-black text-xs sm:text-sm">₹{totalItemAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleCloseModal()}
            className="btn-primary rounded-xl px-5 py-2.5 text-xs font-black shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
            data-testid="button-done-scanning-invoice"
          >
            <span>Done / View Invoice</span>
            <ArrowRight size={14} />
          </button>
        </div>

      </div>
    </div>
  );
};
