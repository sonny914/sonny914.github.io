import { useCallback, useEffect, useState } from 'react';
import type { AuthResult, AuthService } from '../auth/auth';
import type { MemberId } from '../data/types';

export type AuthState = { status: 'loading' } | { status: 'error'; message: string } | AuthResult;

export function useAuth(auth: AuthService) {
  const [state, setState] = useState<AuthState>(() => auth.getSessionNow?.() ?? { status: 'loading' });

  const refresh = useCallback(async () => {
    try {
      setState(await auth.getSession());
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Couldn’t check sign-in.' });
    }
  }, [auth]);

  useEffect(() => {
    if (!auth.getSessionNow) {
      auth.getSession().then(setState, (e: unknown) =>
        setState({ status: 'error', message: e instanceof Error ? e.message : 'Couldn’t check sign-in.' }),
      );
    }
    return auth.subscribe(() => void refresh());
  }, [auth, refresh]);

  const choose = useCallback(
    async (id: MemberId) => {
      await auth.chooseProfile?.(id);
      await refresh();
    },
    [auth, refresh],
  );
  const signOut = useCallback(async () => {
    await auth.signOut();
    await refresh();
  }, [auth, refresh]);

  return { state, refresh, choose, signOut };
}
