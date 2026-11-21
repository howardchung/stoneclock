import { useEffect, useRef, useState } from 'react';

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
}

export function useWakeLock(enabled: boolean) {
  const [isLocked, setIsLocked] = useState(false);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const isSupported =
    typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  useEffect(() => {
    if (!isSupported) return;
    let cancelled = false;

    const requestLock = async () => {
      if (!enabled || document.visibilityState !== 'visible') return;
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
        };
        const sentinel = await nav.wakeLock?.request('screen');
        if (!sentinel) return;
        if (cancelled) {
          await sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
        setIsLocked(true);
        sentinel.addEventListener('release', () => {
          setIsLocked(false);
        });
      } catch {
        setIsLocked(false);
      }
    };

    const releaseLock = async () => {
      if (sentinelRef.current && !sentinelRef.current.released) {
        try {
          await sentinelRef.current.release();
        } catch {
          // ignore
        }
      }
      sentinelRef.current = null;
      setIsLocked(false);
    };

    if (enabled) {
      void requestLock();
    } else {
      void releaseLock();
    }

    const onVisibility = () => {
      if (enabled && document.visibilityState === 'visible') {
        void requestLock();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void releaseLock();
    };
  }, [enabled, isSupported]);

  return { isSupported, isLocked };
}
