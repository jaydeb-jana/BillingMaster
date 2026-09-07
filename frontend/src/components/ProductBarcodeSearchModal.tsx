import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  ScanLine, 
  Camera, 
  Keyboard, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Package, 
  Sparkles, 
  Plus, 
  Pencil, 
  RefreshCw, 
  Search,
  Zap,
  ZapOff,
  Boxes,
  Eye,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { getProductBarcode, getProductUniqueId } from '@/lib/api';
import { getStoredProductSettings } from '@/constants/productSettings';
import { useBodyScrollLock } from '@/lib/useScrollReset';

type ProductRow = Record<string, any>;

interface ProductBarcodeSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductRow[];
  onSelectProductForSearch: (barcodeOrName: string) => void;
  onOpenAddProductWithBarcode?: (barcode: string) => void;
  onEditProduct?: (product: ProductRow) => void;
  onViewProduct?: (product: ProductRow) => void;
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
      osc.frequency.setValueAtTime(900, ctx.currentTime);
      osc.frequency.setValueAtTime(1400, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
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

export const ProductBarcodeSearchModal: React.FC<ProductBarcodeSearchModalProps> = ({
  isOpen,
  onClose,
  products,
  onSelectProductForSearch,
  onOpenAddProductWithBarcode,
  onEditProduct,
  onViewProduct,
}) => {
  useBodyScrollLock(isOpen);
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [scannedCode, setScannedCode] = useState('');
  const [matchedProduct, setMatchedProduct] = useState<ProductRow | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'product-barcode-search-viewfinder';

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setScannedCode('');
      setMatchedProduct(null);
      setHasSearched(false);
    } else {
      setActiveTab('camera');
      setScannedCode('');
      setMatchedProduct(null);
      setHasSearched(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      const timer = setTimeout(() => {
        startScanner();
      }, 200);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen, activeTab]);

  const stopScanner = async () => {
    if (html5QrcodeRef.current) {
      try {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
        html5QrcodeRef.current.clear();
      } catch (e) {
        console.error('Stop scanner error:', e);
      } finally {
        html5QrcodeRef.current = null;
        setIsScanning(false);
        setTorchOn(false);
      }
    }
  };

  const startScanner = async () => {
    setCameraError('');
    await stopScanner();

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
        qrbox: { width: 280, height: 160 },
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

      setIsScanning(true);

      // Check torch capabilities
      try {
        const capabilities: any = instance.getRunningTrackCapabilities();
        if (capabilities && capabilities.torch) {
          setTorchSupported(true);
        }
      } catch (e) {
        setTorchSupported(false);
      }
    } catch (err: any) {
      console.error('Camera start error:', err);
      setIsScanning(false);
      setCameraError(err?.message || 'Unable to access camera sensor. Please check camera permissions.');
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
      } catch (e) {
        toast.error('Torch light toggle not supported on this device.');
      }
    }
  };

  const handleScannedBarcode = (code: string) => {
    const clean = code.trim();
    if (!clean) return;

    const hwSettings = getStoredProductSettings();
    if (hwSettings.soundBeepEnabled) {
      playScanBeep('success');
    }

    setScannedCode(clean);
    lookupProduct(clean);
  };

  const lookupProduct = (code: string) => {
    const clean = code.trim().toLowerCase();
    setHasSearched(true);
    if (!clean) {
      setMatchedProduct(null);
      return;
    }

    const found = products.find(p => {
      const pBarcode = (getProductBarcode(p) || '').toLowerCase();
      const pId = (getProductUniqueId(p) || '').toLowerCase();
      const pName = (p.name || '').toLowerCase();
      const pSku = (p.sku || '').toLowerCase();
      return pBarcode === clean || pId === clean || pSku === clean || pName.includes(clean);
    });

    if (found) {
      setMatchedProduct(found);
      toast.success(`Product found: "${found.name}"`);
    } else {
      setMatchedProduct(null);
      playScanBeep('error');
      toast.warning(`No product found matching barcode "${code}"`);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedCode.trim()) {
      toast.warning('Please enter a barcode number or product SKU.');
      return;
    }
    lookupProduct(scannedCode);
  };

  const handleFilterList = () => {
    if (scannedCode) {
      onSelectProductForSearch(scannedCode);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/60 backdrop-blur-md p-3 sm:p-5 print:hidden animate-in fade-in-0 duration-200">
      <div className="flex flex-col w-full max-w-lg rounded-3xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/80 bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shadow-2xs">
              <ScanLine size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground tracking-tight">Scan Barcode to Find Product</h3>
              <p className="text-xs text-muted-foreground">Scan with camera or barcode gun to search product</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center border-b border-border/80 bg-background px-4 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black border-b-2 transition-all cursor-pointer ${
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
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black border-b-2 transition-all cursor-pointer ${
              activeTab === 'manual'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Keyboard size={15} />
            <span>Manual Type / USB Reader</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 max-h-[75dvh]">

          {/* TAB 1: CAMERA SCANNER */}
          {activeTab === 'camera' && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border border-border bg-black min-h-[220px] flex items-center justify-center shadow-inner">
                <div id={scannerContainerId} className="w-full h-full" />

                {/* Torch Toggle Button */}
                {torchSupported && isScanning && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`absolute top-3 right-3 px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md transition-all cursor-pointer ${
                      torchOn ? 'bg-amber-500 text-white' : 'bg-background/80 text-foreground backdrop-blur-xs hover:bg-background'
                    }`}
                  >
                    {torchOn ? <Zap size={14} /> : <ZapOff size={14} />}
                    <span>{torchOn ? 'Flash ON' : 'Flashlight'}</span>
                  </button>
                )}

                {/* Camera error message */}
                {cameraError && (
                  <div className="p-5 text-center text-white space-y-2 max-w-xs">
                    <AlertCircle size={28} className="mx-auto text-amber-400" />
                    <p className="text-xs font-semibold leading-relaxed">{cameraError}</p>
                    <button
                      type="button"
                      onClick={startScanner}
                      className="px-3.5 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-xs"
                    >
                      Retry Camera Access
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold px-1">
                <span>Align product barcode inside frame to scan</span>
                {isScanning && (
                  <button
                    type="button"
                    onClick={startScanner}
                    className="text-primary hover:underline flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <RotateCcw size={12} />
                    <span>Restart Camera</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MANUAL / USB READER */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1.5">Barcode Number / SKU</label>
                <div className="relative">
                  <ScanLine size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={scannedCode}
                    onChange={(e) => setScannedCode(e.target.value)}
                    placeholder="e.g. 8901234567890 or PRD-849201"
                    className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-2.5 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-2xs"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full btn-primary rounded-xl py-2.5 text-xs font-black shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Search size={15} />
                <span>Search Product</span>
              </button>
            </form>
          )}

          {/* --- SEARCH RESULT DISPLAY --- */}
          {hasSearched && (
            <div className="pt-2 border-t border-border/80 space-y-3">
              {matchedProduct ? (
                <div className="p-4 rounded-2xl border border-primary/40 bg-primary/10 space-y-3 animate-in fade-in-0 duration-200">
                  <div className="flex items-start gap-3">
                    {matchedProduct.image_url ? (
                      <img src={matchedProduct.image_url} alt={matchedProduct.name} className="h-12 w-12 rounded-xl object-cover border border-border shadow-2xs shrink-0" />
                    ) : (
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/20 text-primary font-bold">
                        <Package size={20} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-foreground text-sm tracking-tight">{matchedProduct.name}</span>
                        <span className="text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={10} />
                          <span>Matched</span>
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className="mono font-bold bg-background px-2 py-0.5 rounded border border-border">ID: {getProductUniqueId(matchedProduct)}</span>
                        {getProductBarcode(matchedProduct) && (
                          <span className="mono font-semibold bg-background px-2 py-0.5 rounded border border-border">Barcode: {getProductBarcode(matchedProduct)}</span>
                        )}
                        <span className="font-bold text-foreground">Stock: {matchedProduct.stock_quantity ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for matched product */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleFilterList}
                      className="btn-primary flex-1 rounded-xl py-2 text-xs font-black shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Search size={14} />
                      <span>Filter Products List</span>
                    </button>
                    {onViewProduct && (
                      <button
                        type="button"
                        onClick={() => {
                          onViewProduct(matchedProduct);
                          onClose();
                        }}
                        className="px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                        title="View Full Product Details"
                      >
                        <Eye size={14} />
                        <span>View</span>
                      </button>
                    )}
                    {onEditProduct && (
                      <button
                        type="button"
                        onClick={() => {
                          onEditProduct(matchedProduct);
                          onClose();
                        }}
                        className="px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                        title="Edit Product"
                      >
                        <Pencil size={14} />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 space-y-3 animate-in fade-in-0 duration-200">
                  <div className="flex items-start gap-2.5 text-amber-700 dark:text-amber-300">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-extrabold">No matching product found</h4>
                      <p className="text-[11px] opacity-90 mt-0.5">
                        No product in store inventory has barcode or code <strong className="mono font-extrabold">{scannedCode}</strong>.
                      </p>
                    </div>
                  </div>

                  {onOpenAddProductWithBarcode && scannedCode && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenAddProductWithBarcode(scannedCode);
                        onClose();
                      }}
                      className="w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-black shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={15} />
                      <span>Create New Product with Barcode ({scannedCode})</span>
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
};
