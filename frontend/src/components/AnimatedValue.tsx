import { useEffect, useState } from 'react';

interface AnimatedValueProps {
  value: string | number;
  className?: string;
  duration?: number;
}

// Global session flag: tracks if initial page load animation has executed.
// Automatically resets to false on browser refresh (F5 / hard reload).
let isInitialPageLoadDone = false;

export function AnimatedValue({ value, className = '', duration = 850 }: AnimatedValueProps) {
  const [displayValue, setDisplayValue] = useState<string>(() => {
    const rawStr = String(value ?? '');
    if (isInitialPageLoadDone) {
      return rawStr;
    }
    if (rawStr.includes('₹')) {
      return rawStr.includes('.') ? '₹0.00' : '₹0';
    }
    if (rawStr.toUpperCase().includes('INR')) {
      return rawStr.includes('.') ? 'INR 0.00' : 'INR 0';
    }
    return '0';
  });

  useEffect(() => {
    const rawStr = String(value ?? '');

    // If initial page load animation was already completed, display target value immediately.
    if (isInitialPageLoadDone) {
      setDisplayValue(rawStr);
      return;
    }

    // Extract optional non-digit prefix, digits with decimals/commas, and trailing suffix
    const match = rawStr.match(/^([^\d-]*)([\d,]+(?:\.\d+)?)(.*)$/);
    if (!match) {
      setDisplayValue(rawStr);
      return;
    }

    const prefix = match[1] || '';
    const numStr = match[2].replace(/,/g, '');
    const suffix = match[3] || '';
    const targetNum = parseFloat(numStr);

    if (isNaN(targetNum) || targetNum === 0) {
      setDisplayValue(rawStr);
      return;
    }

    const hasDecimal = numStr.includes('.');
    const decimals = hasDecimal ? (numStr.split('.')[1]?.length || 2) : 0;

    let animationFrameId: number;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic formula for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentNum = targetNum * easeOut;

      const formattedNum = currentNum.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

      setDisplayValue(`${prefix}${formattedNum}${suffix}`);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setDisplayValue(rawStr);
        isInitialPageLoadDone = true;
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    // Set session flag after duration to prevent re-animation on tab switching
    const loadDoneTimer = setTimeout(() => {
      isInitialPageLoadDone = true;
    }, duration + 100);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(loadDoneTimer);
    };
  }, [value, duration]);

  return <span className={className}>{displayValue}</span>;
}
