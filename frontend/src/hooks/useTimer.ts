import { useState, useEffect, useCallback } from 'react';

export function useTimer(expiresAt: string | null, onExpire?: () => void) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const calculateTimeLeft = useCallback(() => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  }, [expiresAt]);

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft(null);
      return;
    }

    setTimeLeft(calculateTimeLeft());
    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining !== null && remaining <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [calculateTimeLeft, expiresAt, onExpire]);

  const safeTimeLeft = timeLeft ?? 0;
  const hours = Math.floor(safeTimeLeft / 3600);
  const minutes = Math.floor((safeTimeLeft % 3600) / 60);
  const seconds = safeTimeLeft % 60;

  const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isLow = timeLeft !== null && timeLeft < 300;

  return { timeLeft, formatted, isLow, isExpired: Boolean(expiresAt && timeLeft === 0) };
}
