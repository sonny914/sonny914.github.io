import { useCallback, useEffect, useMemo, useState } from 'react';
import { demoAuth as auth } from './auth/auth';
import { AddSheet } from './components/AddSheet';
import type { TabId } from './components/BottomNav';
import type { Chrome } from './components/Shell';
import { Notice, type NoticeState } from './components/Notice';
import { localDemoRepository as repo, StorageError } from './data/repository';
import { useNow } from './hooks/useNow';
import { useSession } from './hooks/useSession';
import { attentionItems, type AttentionItem } from './lib/schedule';
import { HomeScreen } from './screens/HomeScreen';
import { HouseholdScreen, type HouseholdView, type ProfileActions } from './screens/HouseholdScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { ScheduleOnboardingScreen } from './screens/ScheduleOnboardingScreen';
import { WhoAreYouScreen } from './screens/WhoAreYouScreen';

export default function App() {
  const now = useNow();
  const [tab, setTab] = useState<TabId>('home');
  const [addOpen, setAddOpen] = useState(false);
  const [householdView, setHouseholdView] = useState<HouseholdView>({ kind: 'list' });
  // Bumped after a write so the snapshot is re-read. A database version would subscribe instead.
  const [version, setVersion] = useState(0);
  const touch = useCallback(() => setVersion((v) => v + 1), []);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  useEffect(() => {
    if (notice?.kind !== 'saved') return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  /** Runs a write. On success: refresh and (optionally) confirm. On failure: say so, keep the form open. */
  const commit = useCallback(
    (savedText: string | null, write: () => void): boolean => {
      try {
        write();
        touch();
        setNotice(savedText ? { kind: 'saved', text: savedText } : null);
        return true;
      } catch (e) {
        setNotice({ kind: 'error', text: e instanceof StorageError ? e.message : 'Something went wrong, so your change was not saved.' });
        return false;
      }
    },
    [touch],
  );

  // eslint-disable-next-line -- `version` is the invalidation key
  const data = useMemo(() => repo.getSnapshot(now), [now, version]);
  const adults = useMemo(() => data.members.filter((m) => m.role === 'adult'), [data.members]);
  const { session, choose, signOut } = useSession(auth, adults.map((a) => a.id));
  const closeAdd = useCallback(() => setAddOpen(false), []);

  const viewingAs = session?.memberId ?? '';
  const attentionCount = useMemo(() => attentionItems(data, now, 'all').length, [data, now]);

  // ---- Not set up yet on this device ----
  if (!session) {
    return (
      <>
        <WhoAreYouScreen adults={adults} auth={auth} onChoose={(id) => { choose(id); setTab('home'); }} />
        <Notice notice={notice} onDismiss={() => setNotice(null)} />
      </>
    );
  }
  const me = adults.find((a) => a.id === session.memberId);
  if (me && !data.setup[me.id]) {
    return (
      <>
        <ScheduleOnboardingScreen
          me={me}
          entries={data.workEntries}
          now={now}
          onSave={(e) => commit('Shift saved on this device only.', () => repo.saveWorkEntry(e))}
          onFinish={() => commit(null, () => repo.completeSetup(me.id, 'done'))}
          onSkip={() => commit(null, () => repo.completeSetup(me.id, 'skipped'))}
        />
        <Notice notice={notice} onDismiss={() => setNotice(null)} />
      </>
    );
  }

  const chrome: Chrome = {
    tab,
    // A confirmation belongs to the screen it was made on, so navigating clears it.
    onTab: (t) => { setNotice(null); setTab(t); if (t === 'household') setHouseholdView({ kind: 'list' }); },
    onAdd: () => setAddOpen(true),
    adults,
    viewingAs,
    onViewingAs: (id) => { setNotice(null); choose(id); setHouseholdView({ kind: 'list' }); },
    attentionCount,
  };

  const homeActions = {
    onAttentionAct: (item: AttentionItem) => {
      return commit(null, () => {
        if (item.kind === 'coverage') repo.claimCoverage(item.sourceId, viewingAs);
        if (item.kind === 'confirmation') repo.confirmEvent(item.sourceId);
        if (item.kind === 'overdue') repo.completeTask(item.sourceId, viewingAs, new Date());
      });
    },
    onAttentionUndo: (item: AttentionItem) => {
      return commit(null, () => {
        if (item.kind === 'coverage') repo.releaseCoverage(item.sourceId);
        if (item.kind === 'confirmation') repo.unconfirmEvent(item.sourceId);
        if (item.kind === 'overdue') repo.reopenTask(item.sourceId);
      });
    },
    onMailCheck: () => commit(null, () => repo.markMailChecked(viewingAs, new Date())),
    onMailUndo: () => commit(null, () => repo.resetMailCheck()),
    onUpdateSchedule: () => {
      setNotice(null);
      setHouseholdView({ kind: 'person', id: viewingAs });
      setTab('household');
    },
  };

  const profileActions: ProfileActions = {
    saveWork: (e) => commit('Shift saved on this device only.', () => repo.saveWorkEntry(e)),
    deleteWork: (id) => commit('Shift deleted.', () => repo.deleteWorkEntry(id)),
    saveUnavailable: (u) => commit('Unavailable time saved on this device only.', () => repo.saveUnavailable(u)),
    deleteUnavailable: (id) => commit('Unavailable time deleted.', () => repo.deleteUnavailable(id)),
    saveUpdate: (u) => commit('Update saved on this device only.', () => repo.saveChildUpdate(u)),
    deleteUpdate: (id) => commit('Update deleted.', () => repo.deleteChildUpdate(id)),
    saveContact: (id, patch) => commit('Details saved on this device only.', () => repo.saveContact(id, patch, viewingAs, new Date())),
    switchPerson: () => { setNotice(null); signOut(); setTab('home'); setHouseholdView({ kind: 'list' }); },
  };

  return (
    <>
      {tab === 'home' && <HomeScreen data={data} now={now} chrome={chrome} actions={homeActions} />}
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
        <HouseholdScreen data={data} now={now} chrome={chrome} auth={auth} view={householdView} onView={(v) => { setNotice(null); setHouseholdView(v); }} actions={profileActions} />
      )}
      <AddSheet open={addOpen} onClose={closeAdd} />
      <Notice notice={notice} onDismiss={() => setNotice(null)} />
    </>
  );
}
