import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Check, Upload, PenTool, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

interface SignaturePadCanvasProps {
  initialImage?: string;
  onSave: (dataUrl: string) => void;
  onClear?: () => void;
}

export function SignaturePadCanvas({ initialImage, onSave, onClear }: SignaturePadCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Initialize Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high resolution display scaling
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    ctx.strokeStyle = '#0f172a'; // Deep navy/slate ink
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // If initial image exists, draw it onto canvas
    if (initialImage) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasDrawn(true);
      };
      img.src = initialImage;
    }
  }, []);

  // Helper to get coordinates
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    setHasDrawn(true);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onClear?.();
    toast.info('Signature canvas reset.');
  };

  const handleSaveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) {
      toast.error('Please draw a signature first.');
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
    toast.success('Digital hand signature saved!');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1 font-bold text-foreground">
          <PenTool size={14} className="text-primary" />
          <span>Draw Signature with Finger / Mouse</span>
        </span>
        <span>Use touch or mouse cursor to sign</span>
      </div>

      {/* Canvas Box */}
      <div className="relative rounded-2xl border-2 border-dashed border-primary/40 bg-card p-1 shadow-inner overflow-hidden group">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-36 bg-white rounded-xl cursor-crosshair touch-none"
        />

        {/* Watermark Helper Text */}
        {!hasDrawn && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 text-xs font-semibold select-none">
            Sign Here ✍️
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleClear}
          className="rounded-xl px-3 py-1.5 border border-border bg-muted/50 hover:bg-muted text-foreground text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Eraser size={13} />
          <span>Clear Canvas</span>
        </button>

        <button
          type="button"
          onClick={handleSaveSignature}
          className="btn-primary rounded-xl px-4 py-1.5 text-xs font-extrabold shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Check size={14} className="stroke-[3]" />
          <span>Save Hand Signature</span>
        </button>
      </div>
    </div>
  );
}
