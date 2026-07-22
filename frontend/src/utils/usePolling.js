import { useEffect, useRef } from 'react';

/**
 * Calls `fn` immediately and then every `interval` ms while the tab is visible.
 * Pauses polling when the tab is hidden to save resources.
 */
export default function usePolling(fn, interval = 15000) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let timerId = null;

    const tick = () => {
      fnRef.current();
    };

    const schedule = () => {
      timerId = setInterval(tick, interval);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        clearInterval(timerId);
      } else {
        tick(); // refresh immediately when tab becomes visible
        schedule();
      }
    };

    tick(); // run immediately on mount
    schedule();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(timerId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [interval]);
}
