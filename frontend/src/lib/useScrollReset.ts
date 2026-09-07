import { useEffect } from 'react';

/**
 * Resets window and element scroll positions to top when a trigger changes or component mounts.
 */
export function useScrollReset(trigger?: any) {
  useEffect(() => {
    // Reset window and document scroll
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // Reset container element scroll for modals and dialogs
    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
      const scrollables = document.querySelectorAll(
        '.card-shell, .overflow-y-auto, .overflow-auto, [role="dialog"], [data-radix-scroll-area-viewport], main'
      );
      scrollables.forEach((el) => {
        el.scrollTop = 0;
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [trigger]);
}

/**
 * Callback ref to attach to scrollable modal elements to guarantee scrollTop = 0 on mount.
 */
export function resetScrollRef(el: HTMLElement | null) {
  if (el) {
    el.scrollTop = 0;
  }
}

let lockCount = 0;
let originalOverflow = '';

/**
 * Prevents background document body scroll bleed when a modal or dialog overlay is active.
 */
export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    if (lockCount === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount++;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = originalOverflow || '';
      }
    };
  }, [isLocked]);
}
