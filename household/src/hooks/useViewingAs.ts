import { useCallback, useState } from 'react';
import type { MemberId } from '../data/types';

const KEY = 'cottage.demo.viewingAs.v1';

/** Stand-in for "who is signed in" until real accounts exist. */
export function useViewingAs(adultIds: MemberId[]): [MemberId, (id: MemberId) => void] {
  const [id, setId] = useState<MemberId>(() => {
    try {
      const stored = window.localStorage.getItem(KEY);
      if (stored && adultIds.includes(stored)) return stored;
    } catch {
      /* ignore */
    }
    return adultIds[0] ?? '';
  });
  const set = useCallback((next: MemberId) => {
    setId(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
  }, []);
  return [id, set];
}
