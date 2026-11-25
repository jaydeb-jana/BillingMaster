import type { Html5Qrcode } from 'html5-qrcode';

/**
 * Force stop all tracks on a MediaStream to power down the camera sensor
 * and immediately extinguish the camera hardware indicator light.
 */
export function stopMediaStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  try {
    const tracks = stream.getTracks ? stream.getTracks() : [];
    tracks.forEach((track) => {
      try {
        if (track.readyState === 'live') {
          track.stop();
        }
      } catch (err) {
        console.warn('Failed stopping track:', err);
      }
    });
  } catch (err) {
    console.warn('Failed getting stream tracks:', err);
  }
}

/**
 * Searches the DOM (or a specific parent container) for any <video> elements,
 * extracts their srcObject MediaStreams, calls track.stop() on all tracks,
 * removes src/srcObject, pauses and unloads the video element.
 *
 * This guarantees the camera light turns OFF immediately, even if
 * Html5Qrcode or React unmounts or throws.
 */
export function stopAllVideoElementStreams(rootElement?: HTMLElement | Document | string | null): void {
  try {
    let root: HTMLElement | Document | null = null;
    if (typeof rootElement === 'string') {
      root = (typeof document !== 'undefined' ? document.getElementById(rootElement) : null) || (typeof document !== 'undefined' ? document : null);
    } else {
      root = rootElement || (typeof document !== 'undefined' ? document : null);
    }
    if (!root) return;

    const videoElements = root.querySelectorAll<HTMLVideoElement>('video');
    videoElements.forEach((video) => {
      try {
        if (video.srcObject) {
          if (video.srcObject instanceof MediaStream) {
            stopMediaStream(video.srcObject);
          } else if (typeof (video.srcObject as any).getTracks === 'function') {
            stopMediaStream(video.srcObject as unknown as MediaStream);
          }
          video.srcObject = null;
        }
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch (err) {
        console.warn('Error cleaning video element stream:', err);
      }
    });
  } catch (err) {
    console.warn('Error querying video elements:', err);
  }
}

/**
 * Safely stops and clears an Html5Qrcode instance without throwing or leaving orphan tracks.
 * Always stops any video element tracks in the container first to extinguish the camera light immediately.
 */
export async function safeStopHtml5Qrcode(
  scanner: Html5Qrcode | null | undefined,
  containerId?: string
): Promise<void> {
  // 1. Immediately kill video tracks in the container if container exists
  if (containerId && typeof document !== 'undefined') {
    const container = document.getElementById(containerId);
    if (container) {
      stopAllVideoElementStreams(container);
    }
  }

  if (!scanner) {
    if (containerId && typeof document !== 'undefined') {
      const container = document.getElementById(containerId);
      if (container) stopAllVideoElementStreams(container);
    }
    return;
  }

  try {
    // 2. Check if the scanner is currently running / scanning
    let isRunning = false;
    try {
      if (typeof (scanner as any).getState === 'function') {
        const state = (scanner as any).getState();
        // Html5QrcodeScannerState: 1 = NOT_STARTED, 2 = SCANNING, 3 = PAUSED
        isRunning = state === 2 || state === 3;
      } else {
        isRunning = Boolean((scanner as any).isScanning);
      }
    } catch {
      isRunning = Boolean((scanner as any).isScanning);
    }

    if (isRunning) {
      await scanner.stop().catch((err) => {
        console.warn('Html5Qrcode.stop() ignored error:', err);
      });
    }

    // 3. Clear container DOM and memory
    try {
      scanner.clear();
    } catch {
      if (containerId && typeof document !== 'undefined') {
        const container = document.getElementById(containerId);
        if (container) {
          container.innerHTML = '';
        }
      }
    }
  } catch (err) {
    console.warn('safeStopHtml5Qrcode top error:', err);
  } finally {
    // 4. Double check all video elements in container and stop any lingering tracks
    if (containerId && typeof document !== 'undefined') {
      const container = document.getElementById(containerId);
      if (container) {
        stopAllVideoElementStreams(container);
      }
    }
  }
}
