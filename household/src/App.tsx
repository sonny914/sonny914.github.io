import { useCallback, useMemo, useState } from 'react';
import { AddSheet } from './components/AddSheet';
import { BottomNav, type TabId } from './components/BottomNav';
import { PlusIcon } from './components/Icons';
import { localDemoRepository as repo } from './data/repository';
import type { MemberId } from './data/types';
import { useNow } from './hooks/useNow';
import { HomeScreen } from './screens/HomeScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';

export default function App() {
  const now = useNow();
  const [tab, setTab] = useState<TabId>('home');
  const [addOpen, setAddOpen] = useState(false);
  // Bumped after a write so the snapshot is re-read. A database version would subscribe instead.
  const [version, setVersion] = useState(0);

  const data = useMemo(() => repo.getSnapshot(now), [now, version]);

  const checkMail = useCallback((by: MemberId) => {
    repo.markMailChecked(by, new Date());
    setVersion((v) => v + 1);
  }, []);
  const undoMail = useCallback(() => {
    repo.resetMailCheck(new Date());
    setVersion((v) => v + 1);
  }, []);
  const closeAdd = useCallback(() => setAddOpen(false), []);

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>

      {tab === 'home' && <HomeScreen data={data} now={now} onMailCheck={checkMail} onMailUndo={undoMail} />}
      {tab === 'calendar' && (
        <PlaceholderScreen
          title="Calendar"
          intro="The whole household on one calendar."
          coming={['Month and week views', 'Everyone’s shifts, school days and appointments together', 'Add and edit events', 'Recurring events']}
        />
      )}
      {tab === 'coverage' && (
        <PlaceholderScreen
          title="Coverage"
          intro="Make sure every pickup, drop-off and care gap has someone."
          coming={['Open and claimed coverage requests', 'Spot gaps from shift schedules', 'One-tap “I can cover this”', 'Confirmations everyone can see']}
        />
      )}
      {tab === 'household' && (
        <PlaceholderScreen
          title="Household"
          intro="People, routines and recurring reminders."
          coming={['Profiles for adults, Khodi and Kenzli (rename Adult 3 here)', 'Recurring reminders like the mail', 'Uploaded work schedules', 'Household settings']}
        />
      )}

      <button type="button" className="fab" onClick={() => setAddOpen(true)} aria-haspopup="dialog">
        <PlusIcon size={22} />
        <span>Add</span>
      </button>
      <BottomNav tab={tab} onChange={setTab} />
      <AddSheet open={addOpen} onClose={closeAdd} />
    </div>
  );
}
