import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HouseholdRepository } from '../data/repository';
import type { HouseholdSnapshot } from '../data/types';

const POLL_MS = 60_000;

/**
 * The household's data. Local repositories answer immediately (no empty first paint); shared ones load
 * from the server, then refresh after every write, when the tab regains focus, and once a minute, so
 * what another adult saved shows up without a manual reload.
 */
export function useSnapshot(repo: HouseholdRepository, now: Date, enabled: boolean) {
  const [version, setVersion] = useState(0);
  const [remote, setRemote] = useState<HouseholdSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const immediate = useMemo(
    () => (enabled && repo.loadNow ? repo.loadNow(now) : null),
    // `version` invalidates after a local write.
    // eslint-disable-next-line
    [repo, enabled, now, version],
  );

  const refresh = useCallback(async () => {
    if (repo.loadNow) {
      setVersion((v) => v + 1);
      return;
    }
    const s = await repo.load(new Date());
    setRemote(s);
    setError(null);
  }, [repo]);

  const quietRefresh = useCallback(async () => {
    try {
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t load the household.');
    }
  }, [refresh]);

  useEffect(() => {
    if (!enabled || repo.loadNow) return;
    repo.load(new Date()).then(
      (s) => {
        setRemote(s);
        setError(null);
      },
      (e: unknown) => setError(e instanceof Error ? e.message : 'Couldn’t load the household.'),
    );
    const onFocus = () => void quietRefresh();
    const id = window.setInterval(onFocus, POLL_MS);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, repo, quietRefresh]);

  return { data: immediate ?? remote, error: remote ? null : error, refresh, retry: quietRefresh };
}
