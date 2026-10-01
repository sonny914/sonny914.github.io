import { useCallback, useMemo, useState } from 'react';
import { AddSheet } from './components/AddSheet';
import type { TabId } from './components/BottomNav';
import type { Chrome } from './components/Shell';
import { localDemoRepository as repo } from './data/repository';
import { useNow } from './hooks/useNow';
import { useViewingAs } from './hooks/useViewingAs';
import { attentionItems, type AttentionItem } from './lib/schedule';
import { HomeScreen } from './screens/HomeScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';

export default function App() {
  const now = useNow();
  const [tab, setTab] = useState<TabId>('home');
  const [addOpen, setAddOpen] = useState(false);
  // Bumped after a write so the snapshot is re-read. A database version would subscribe instead.
  const [version, setVersion] = useState(0);
  const touch = useCallback(() => setVersion((v) => v + 1), []);

  // eslint-disable-next-line -- `version` is the invalidation key
  const data = useMemo(() => repo.getSnapshot(now), [now, version]);
  const adults = useMemo(() => data.members.filter((m) => m.role === 'adult'), [data.members]);
  const [viewingAs, setViewingAs] = useViewingAs(adults.map((a) => a.id));
  const closeAdd = useCallback(() => setAddOpen(false), []);

  const attentionCount = useMemo(() => attentionItems(data, now, 'all').length, [data, now]);

  const chrome: Chrome = {
    tab,
    onTab: setTab,
    onAdd: () => setAddOpen(true),
    adults,
    viewingAs,
    onViewingAs: setViewingAs,
    attentionCount,
  };

  const actions = {
    onAttentionAct: (item: AttentionItem) => {
      if (item.kind === 'coverage') repo.claimCoverage(item.sourceId, viewingAs);
      if (item.kind === 'confirmation') repo.confirmEvent(item.sourceId);
      if (item.kind === 'overdue') repo.completeTask(item.sourceId, viewingAs, new Date());
      touch();
    },
    onMailCheck: () => {
      repo.markMailChecked(viewingAs, new Date());
      touch();
    },
    onMailUndo: () => {
      repo.resetMailCheck();
      touch();
    },
  };

  return (
    <>
      {tab === 'home' && <HomeScreen data={data} now={now} chrome={chrome} actions={actions} />}
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
        <PlaceholderScreen
          chrome={chrome}
          title="Household"
          intro="People, routines and recurring reminders."
          coming={['Profiles for the adults, Khodi and Kenzli (rename Adult 3 here)', 'Recurring reminders like the mail', 'Uploaded work schedules']}
        />
      )}
      <AddSheet open={addOpen} onClose={closeAdd} />
    </>
  );
}
