import { useCallback, useState } from 'react';
import type { AuthService, AuthSession } from '../auth/auth';
import type { MemberId } from '../data/types';

export function useSession(auth: AuthService, adultIds: MemberId[]) {
  const [session, setSession] = useState<AuthSession | null>(() => auth.getSession(adultIds));
  const choose = useCallback(
    (id: MemberId) => {
      auth.chooseProfile(id);
      setSession({ memberId: id });
    },
    [auth],
  );
  const signOut = useCallback(() => {
    auth.signOut();
    setSession(null);
  }, [auth]);
  return { session, choose, signOut };
}
