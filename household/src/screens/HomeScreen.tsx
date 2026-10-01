import { useMemo, useState } from 'react';
import { MailCard } from '../components/MailCard';
import { MemberFilter } from '../components/MemberFilter';
import { NeedsAttention } from '../components/NeedsAttention';
import { TodayTimeline } from '../components/TodayTimeline';
import { UpcomingList } from '../components/UpcomingList';
import type { HouseholdSnapshot, MemberId } from '../data/types';
import { formatLongDate, greeting } from '../lib/dates';
import { type MemberFilter as Filter, attentionItems, eventsOnDay, upcomingByDay } from '../lib/schedule';

export function HomeScreen({
  data,
  now,
  onMailCheck,
  onMailUndo,
}: {
  data: HouseholdSnapshot;
  now: Date;
  onMailCheck: (by: MemberId) => void;
  onMailUndo: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const adults = useMemo(() => data.members.filter((m) => m.role === 'adult'), [data.members]);
  const filterName = data.members.find((m) => m.id === filter)?.name;

  const today = useMemo(() => eventsOnDay(data.events, now, filter), [data.events, now, filter]);
  const upcoming = useMemo(() => upcomingByDay(data.events, now, filter), [data.events, now, filter]);
  const attention = useMemo(() => attentionItems(data, now, filter), [data, now, filter]);

  return (
    <main className="screen" id="main">
      <header className="home-head">
        <p className="home-greeting">{greeting(now)}</p>
        <h1 className="home-title">Our home today</h1>
        <p className="home-date">{formatLongDate(now)}</p>
      </header>

      <MemberFilter members={data.members} value={filter} onChange={setFilter} />

      <NeedsAttention items={attention} members={data.members} today={now} filterName={filterName} />
      <MailCard mail={data.mailCheck} adults={adults} now={now} onCheck={onMailCheck} onUndo={onMailUndo} />
      <TodayTimeline events={today} members={data.members} now={now} filterName={filterName} />
      <UpcomingList groups={upcoming} members={data.members} today={now} filterName={filterName} />
    </main>
  );
}
