import { useEffect, useMemo, useState } from 'react';

/** Whole seconds left until a server-time deadline, or null when nobody is on the clock. */
export function useCountdown(deadline: number | null, serverTime: number): number | null {
  // The server clock may differ from this device's clock; measure the gap when the view arrives.
  const offset = useMemo(() => serverTime - Date.now(), [serverTime, deadline]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);

  if (deadline === null) return null;
  return Math.max(0, Math.ceil((deadline - (now + offset)) / 1000));
}

export function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
