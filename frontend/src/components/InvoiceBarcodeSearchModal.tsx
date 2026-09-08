import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  ScanLine, 
  Camera, 
  Keyboard, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Zap, 
  ZapOff, 
  ArrowRight,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import { useBodyScrollLock } from '@/lib/useScrollReset';

type Row = Record<string, any>;

interface InvoiceBarcodeSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: Row[];
  onSelectInvoiceForSearch: (scannedCode: string) => void;
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

export const InvoiceBarcodeSearchModal: React.FC<InvoiceBarcodeSearchModalProps> = ({
  isOpen,
  onClose,
  invoices,
  onSelectInvoiceForSearch,
}) => {
  useBodyScrollLock(isOpen);
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [scannedCode, setScannedCode] = useState('');
  const [matchedInvoice, setMatchedInvoice] = useState<Row | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'invoice-barcode-search-viewfinder';

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setScannedCode('');
      setMatchedInvoice(null);
      setHasSearched(false);
    } else {
      setActiveTab('camera');
      setScannedCode('');
      setMatchedInvoice(null);
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
      const instance = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false
      });
      html5QrcodeRef.current = instance;

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 160 },
        aspectRatio: 1.777778,
      };

      await instance.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleScannedBarcode(decodedText);
        },
        () => {}
      );

      setIsScanning(true);

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
      setCameraError(err?.message || 'Unable to access camera. Please check camera permissions.');
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
        toast.error('Flashlight toggle not supported on this device.');
      }
    }
  };

  const handleScannedBarcode = (code: string) => {
    const clean = code.trim();
    if (!clean) return;

    playScanBeep('success');
    setScannedCode(clean);
    lookupInvoice(clean);
  };

  const lookupInvoice = (code: string) => {
    const clean = code.trim();
    const cleanLower = clean.toLowerCase();
    setHasSearched(true);
    if (!clean) {
      setMatchedInvoice(null);
      return;
    }

    // Try finding exact or partial invoice number match
    const found = invoices.find(inv => {
      const invNum = (inv.invoice_number || '').toLowerCase();
      const invId = (inv.id || '').toLowerCase();
      return invNum === cleanLower || invId === cleanLower || invNum.includes(cleanLower);
    });

    if (found) {
      setMatchedInvoice(found);
      toast.success(`Invoice "${found.invoice_number || clean}" found!`);
      // Auto submit search after brief highlight
      setTimeout(() => {
        onSelectInvoiceForSearch(found.invoice_number || clean);
        onClose();
      }, 500);
    } else {
      setMatchedInvoice(null);
      playScanBeep('error');
      toast.info(`Searching for invoice: "${clean}"`);
    }
  };

  const handleApplySearch = () => {
    if (scannedCode) {
      onSelectInvoiceForSearch(scannedCode);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-md rounded-2xl bg-card border border-border p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 font-black text-foreground text-base">
            <ScanLine size={20} className="text-primary" />
            <span>Scan Invoice Barcode</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="grid grid-cols-2 gap-2 bg-muted/50 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('camera')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'camera'
                ? 'bg-card text-primary shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Camera size={15} />
            <span>Camera Scanner</span>
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'manual'
                ? 'bg-card text-primary shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Keyboard size={15} />
            <span>Manual Input</span>
          </button>
        </div>

        {/* Camera Tab Content */}
        {activeTab === 'camera' && (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl bg-black border border-border/80 min-h-[220px] flex items-center justify-center">
              <div id={scannerContainerId} className="w-full h-full" />
              
              {/* Torch button */}
              {isScanning && torchSupported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-colors ${
                    torchOn ? 'bg-amber-500 text-white' : 'bg-black/60 text-white hover:bg-black/80'
                  }`}
                  title={torchOn ? 'Turn Flashlight Off' : 'Turn Flashlight On'}
                >
                  {torchOn ? <Zap size={16} /> : <ZapOff size={16} />}
                </button>
              )}

              {/* Viewfinder Overlay Box */}
              {isScanning && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-64 h-36 border-2 border-primary/90 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] relative">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary" />
                  </div>
                </div>
              )}

              {/* Error fallback */}
              {cameraError && (
                <div className="p-4 text-center text-xs text-rose-400 space-y-2">
                  <AlertCircle size={28} className="mx-auto" />
                  <p>{cameraError}</p>
                  <button
                    onClick={startScanner}
                    className="px-3 py-1.5 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90"
                  >
                    Retry Camera
                  </button>
                </div>
              )}
            </div>

            <p className="text-[11px] text-center text-muted-foreground font-medium">
              Point your camera at the 1D Barcode or QR Code printed on the invoice.
            </p>
          </div>
        )}

        {/* Manual Input Tab Content */}
        {activeTab === 'manual' && (
          <div className="space-y-3 py-2">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Enter Invoice Number / Barcode
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={scannedCode}
                onChange={(e) => setScannedCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') lookupInvoice(scannedCode);
                }}
                placeholder="e.g. INV-2035"
                className="input-shell flex-1 px-3 py-2 text-sm font-bold"
                autoFocus
              />
              <button
                onClick={() => lookupInvoice(scannedCode)}
                className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-1 text-xs"
              >
                <Search size={14} />
                <span>Find</span>
              </button>
            </div>
          </div>
        )}

        {/* Scanned Result Card */}
        {scannedCode && (
          <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-muted-foreground uppercase tracking-wider text-[10px]">
                Scanned Code:
              </span>
              <span className="mono font-black text-primary bg-primary/10 px-2 py-0.5 rounded">
                {scannedCode}
              </span>
            </div>

            {matchedInvoice ? (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={15} />
                  <span>Invoice Found: {matchedInvoice.invoice_number}</span>
                </div>
                <div className="text-[11px] text-muted-foreground flex justify-between pt-1 border-t border-emerald-500/20">
                  <span>Customer: {matchedInvoice.customer_name || 'Customer'}</span>
                  <span className="font-bold">Total: ₹{Number(matchedInvoice.total || 0).toFixed(2)}</span>
                </div>
              </div>
            ) : hasSearched ? (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-semibold">
                <AlertCircle size={15} />
                <span>No exact invoice match found, but search filter will apply.</span>
              </div>
            ) : null}

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleApplySearch}
                className="px-4 py-1.5 bg-primary text-primary-foreground font-bold rounded-lg text-xs hover:bg-primary/90 flex items-center gap-1"
              >
                <span>Filter Invoices</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
