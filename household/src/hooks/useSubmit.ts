import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs a save. While it runs the form shows "Saving…" and ignores a second tap. The form stays mounted
 * until the caller decides to close it, so nothing typed is lost if the save fails.
 */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = useCallback(async (fn: () => void | Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }, []);
  return { busy, run };
}
