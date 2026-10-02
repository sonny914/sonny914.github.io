import { useCallback, useMemo, useState } from 'react';
import { AddSheet } from './components/AddSheet';
import type { TabId } from './components/BottomNav';
import { Notice, type NoticeState } from './components/Notice';
import type { Chrome } from './components/Shell';
import { saveErrorMessage } from './data/errors';
import { MEMBERS } from './data/members';
import { readLocalDemoState } from './data/repository';
import { useAuth } from './hooks/useAuth';
import { useNow } from './hooks/useNow';
import { useSnapshot } from './hooks/useSnapshot';
import { hasLocalRecords } from './import/plan';
import { attentionItems, type AttentionItem } from './lib/schedule';
import { HomeScreen } from './screens/HomeScreen';
import { HouseholdScreen, type HouseholdView, type ProfileActions } from './screens/HouseholdScreen';
import { ImportReviewScreen } from './screens/ImportReviewScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { ScheduleOnboardingScreen } from './screens/ScheduleOnboardingScreen';
import { SignInScreen } from './screens/SignInScreen';
import { ErrorScreen, LoadingScreen, UnlinkedScreen } from './screens/StatusScreens';
import { WhoAreYouScreen } from './screens/WhoAreYouScreen';
import { defaultServices, type Services } from './services';

export default function App({ services }: { services?: Services }) {
  const resolved = useMemo(() => (services ? ({ ok: true, services } as const) : defaultServices()), [services]);
  if (!resolved.ok) return <ErrorScreen title="The Cottage can’t start." message={resolved.reason} />;
  return <Cottage services={resolved.services} />;
}

const reviewedKey = (me: string) => `cottage.import.reviewed.${me}`;
const wasReviewed = (me: string) => {
  try {
    return window.localStorage.getItem(reviewedKey(me)) === '1';
  } catch {
    return false;
  }
};

function Cottage({ services: { repo, auth } }: { services: Services }) {
  const now = useNow();
  const [tab, setTab] = useState<TabId>('home');
  const [addOpen, setAddOpen] = useState(false);
  const [householdView, setHouseholdView] = useState<HouseholdView>({ kind: 'list' });
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [importForced, setImportForced] = useState(false);
  const [importTick, setImportTick] = useState(0);

  const { state: authState, refresh: refreshAuth, choose, signOut } = useAuth(auth);
  const signedIn = authState.status === 'signed-in';
  const me = authState.status === 'signed-in' ? authState.session.memberId : '';
  const email = authState.status === 'signed-in' ? authState.session.email : undefined;

  const snap = useSnapshot(repo, now, signedIn);
  const data = snap.data;
  const adults = useMemo(() => (data?.members ?? MEMBERS).filter((m) => m.role === 'adult'), [data]);
  const attentionCount = useMemo(() => (data ? attentionItems(data, now, 'all').length : 0), [data, now]);
  const closeAdd = useCallback(() => setAddOpen(false), []);

  // Records saved by the single-device demo. Only ever offered for review in shared mode; never uploaded silently.
  const localRecords = useMemo(
    () => repo.mode === 'shared' && signedIn && hasLocalRecords(readLocalDemoState()),
    // `importTick` re-checks after an import or removal.
    // eslint-disable-next-line
    [repo.mode, signedIn, importTick],
  );

  const savedText = (what: string) => (repo.mode === 'demo' ? `${what} saved on this device only.` : `${what} saved.`);

  /**
   * Runs one write. Success: reload, then confirm. Failure: say so, change nothing on screen, and return
   * false so the form stays open with everything the person typed.
   */
  const commit = useCallback(
    async (confirmation: string | null, write: () => Promise<void>): Promise<boolean> => {
      try {
        await write();
      } catch (e) {
        setNotice({ kind: 'error', text: saveErrorMessage(e) });
        return false;
      }
      try {
        await snap.refresh();
        setNotice(confirmation ? { kind: 'saved', text: confirmation } : null);
      } catch {
        // The change was stored; only the reload failed. Say exactly that.
        setNotice({ kind: 'saved', text: `${confirmation ?? 'Saved.'} The list will update when the connection is back.` });
      }
      return true;
    },
    [snap],
  );

  const withNotice = (node: React.ReactNode) => (
    <>
      {node}
      <Notice notice={notice} onDismiss={() => setNotice(null)} />
    </>
  );

  // ---- Who is this? ----
  if (authState.status === 'loading') return withNotice(<LoadingScreen label="Checking sign-in…" />);
  if (authState.status === 'error') {
    return withNotice(<ErrorScreen title="Couldn’t check sign-in." message={authState.message} onRetry={() => void refreshAuth()} />);
  }
  if (authState.status === 'signed-out') {
    return withNotice(
      auth.kind === 'account' ? (
        <SignInScreen auth={auth} onSignedIn={() => void refreshAuth()} />
      ) : (
        <WhoAreYouScreen adults={adults} auth={auth} onChoose={(id) => { void choose(id); setTab('home'); }} />
      ),
    );
  }
  if (authState.status === 'unlinked') return withNotice(<UnlinkedScreen email={authState.email} onSignOut={() => void signOut()} />);

  // ---- Signed in: the household ----
  if (!data) {
    return withNotice(
      snap.error ? (
        <ErrorScreen title="Couldn’t load the household." message={snap.error} onRetry={() => void snap.retry()} onSignOut={() => void signOut()} />
      ) : (
        <LoadingScreen />
      ),
    );
  }

  const finishImport = () => {
    try {
      window.localStorage.setItem(reviewedKey(me), '1');
    } catch {
      /* ignore */
    }
    setImportForced(false);
    setImportTick((t) => t + 1);
  };
  if (repo.mode === 'shared' && (importForced || (localRecords && !wasReviewed(me)))) {
    return withNotice(
      <ImportReviewScreen
        repo={repo}
        me={me}
        shared={data}
        onDone={finishImport}
        onImported={async () => {
          setImportTick((t) => t + 1);
          try {
            await snap.refresh();
          } catch {
            /* the next refresh will pick it up */
          }
        }}
      />,
    );
  }

  const myProfile = adults.find((a) => a.id === me);
  if (myProfile && !data.setup[myProfile.id]) {
    return withNotice(
      <ScheduleOnboardingScreen
        me={myProfile}
        entries={data.workEntries}
        now={now}
        where={repo.mode === 'demo' ? 'Saved on this device only until shared saving is set up.' : 'Shifts you save are shared with the other adults.'}
        onSave={(e) => commit(savedText('Shift'), () => repo.saveWorkEntry(e))}
        onFinish={() => commit(null, () => repo.completeSetup(myProfile.id, 'done'))}
        onSkip={() => commit(null, () => repo.completeSetup(myProfile.id, 'skipped'))}
      />,
    );
  }

  const chrome: Chrome = {
    tab,
    // A confirmation belongs to the screen it was made on, so navigating clears it.
    onTab: (t) => { setNotice(null); setTab(t); if (t === 'household') setHouseholdView({ kind: 'list' }); },
    onAdd: () => setAddOpen(true),
    adults,
    viewingAs: me,
    canSwitch: auth.kind === 'demo',
    onViewingAs: (id) => { setNotice(null); void choose(id); setHouseholdView({ kind: 'list' }); },
    attentionCount,
  };

  const homeActions = {
    onAttentionAct: (item: AttentionItem) =>
      commit(null, async () => {
        if (item.kind === 'coverage') await repo.claimCoverage(item.sourceId, me);
        if (item.kind === 'confirmation') await repo.confirmEvent(item.sourceId);
        if (item.kind === 'overdue') await repo.completeTask(item.sourceId, me, new Date());
      }),
    onAttentionUndo: (item: AttentionItem) =>
      commit(null, async () => {
        if (item.kind === 'coverage') await repo.releaseCoverage(item.sourceId);
        if (item.kind === 'confirmation') await repo.unconfirmEvent(item.sourceId);
        if (item.kind === 'overdue') await repo.reopenTask(item.sourceId);
      }),
    onMailCheck: () => commit(null, () => repo.markMailChecked(me, new Date())),
    onMailUndo: () => commit(null, () => repo.resetMailCheck()),
    onUpdateSchedule: () => {
      setNotice(null);
      setHouseholdView({ kind: 'person', id: me });
      setTab('household');
    },
  };

  const profileActions: ProfileActions = {
    saveWork: (e) => commit(savedText('Shift'), () => repo.saveWorkEntry(e)),
    deleteWork: (id) => commit('Shift deleted.', () => repo.deleteWorkEntry(id)),
    saveUnavailable: (u) => commit(savedText('Unavailable time'), () => repo.saveUnavailable(u)),
    deleteUnavailable: (id) => commit('Unavailable time deleted.', () => repo.deleteUnavailable(id)),
    saveUpdate: (u) => commit(savedText('Update'), () => repo.saveChildUpdate(u)),
    deleteUpdate: (id) => commit('Update deleted.', () => repo.deleteChildUpdate(id)),
    saveContact: (id, patch) => commit(savedText('Details'), () => repo.saveContact(id, patch, me, new Date())),
    switchPerson: () => { setNotice(null); setTab('home'); setHouseholdView({ kind: 'list' }); void signOut(); },
  };

  return withNotice(
    <>
      {tab === 'home' && <HomeScreen data={data} now={now} chrome={chrome} actions={homeActions} coverageTracked={repo.mode === 'demo'} />}
      {tab === 'calendar' && (
        <PlaceholderScreen
          chrome={chrome}
          title="Calendar"
          intro="The whole household on one calendar."
          coming={['Month and week views', 'Everyone’s shifts, school days and appointments together', 'Add and edit events', 'Recurring events']}
        />
      )}
      {tab === 'coverage' && (
        <PlaceholderScreen
          chrome={chrome}
          title="Coverage"
          intro="Every pickup, drop-off and care gap has someone."
          coming={['Open and claimed coverage requests', 'Spot gaps from shift schedules', 'Confirmations everyone can see']}
        />
      )}
      {tab === 'household' && (
        <HouseholdScreen
          data={data}
          now={now}
          chrome={chrome}
          auth={auth}
          email={email}
          canReviewImport={localRecords}
          onReviewImport={() => setImportForced(true)}
          view={householdView}
          onView={(v) => { setNotice(null); setHouseholdView(v); }}
          actions={profileActions}
        />
      )}
      <AddSheet open={addOpen} onClose={closeAdd} />
    </>,
  );
}
