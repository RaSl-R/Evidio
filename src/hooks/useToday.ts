import { useState, useEffect } from 'react';

/**
 * Returns today's date formatted as YYYY-MM-DD in local time.
 * Never uses toISOString() to avoid timezone mismatch.
 */
export function getLocalTodayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Hook providing todayStr (local YYYY-MM-DD) refreshed on visibilitychange and at midnight.
 */
export function useToday(): string {
  const [todayStr, setTodayStr] = useState<string>(() => getLocalTodayStr());

  useEffect(() => {
    const updateIfChanged = () => {
      const latest = getLocalTodayStr();
      setTodayStr((prev) => (prev !== latest ? latest : prev));
    };

    // Refresh on tab visibilitychange (when user returns to the tab)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateIfChanged();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Schedule timer to fire at local midnight
    let midnightTimer: any;
    const scheduleMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        2 // 2 seconds after midnight
      );
      const delay = Math.max(1000, nextMidnight.getTime() - now.getTime());
      midnightTimer = setTimeout(() => {
        updateIfChanged();
        scheduleMidnight();
      }, delay);
    };

    scheduleMidnight();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearTimeout(midnightTimer);
    };
  }, []);

  return todayStr;
}
