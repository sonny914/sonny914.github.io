import { useEffect, useState } from 'react';

const QUERY = '(max-width: 959px)';

/** True on phone and tablet widths, where the board is a single column. */
export function useIsNarrow(): boolean {
  const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const [narrow, setNarrow] = useState(() => (supported ? window.matchMedia(QUERY).matches : false));
  useEffect(() => {
    if (!supported) return;
    const mq = window.matchMedia(QUERY);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [supported]);
  return narrow;
}
