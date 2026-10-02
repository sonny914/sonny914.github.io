import { useMemo, useState } from 'react';
import { MailCard } from '../components/MailCard';
import { MemberFilter } from '../components/MemberFilter';
import { NeedsAttention } from '../components/NeedsAttention';
import { type Chrome, Shell } from '../components/Shell';
import { TodayTimeline } from '../components/TodayTimeline';
import { UpcomingList } from '../components/UpcomingList';
import type { HouseholdSnapshot } from '../data/types';
import { formatLongDate, formatTime, greeting, parseLocal } from '../lib/dates';
import {
  type AttentionItem,
  type MemberFilter as Filter,
  attentionItems,
  eventsOnDay,
  nextUp,
  upcomingByDay,
} from '../lib/schedule';

export interface HomeActions {
  onAttentionAct: (item: AttentionItem) => Promise<boolean>;
  onAttentionUndo: (item: AttentionItem) => Promise<boolean>;
  onMailCheck: () => Promise<boolean>;
  onMailUndo: () => Promise<boolean>;
  onUpdateSchedule: () => void;
}

export function HomeScreen({
  data,
  now,
  chrome,
  actions,
  coverageTracked,
}: {
  data: HouseholdSnapshot;
  now: Date;
  chrome: Chrome;
  actions: HomeActions;
  coverageTracked: boolean;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const me = data.members.find((m) => m.id === chrome.viewingAs);
  const filterName = data.members.find((m) => m.id === filter)?.name;

  const view = useMemo(() => {
    const todayAll = eventsOnDay(data.events, now, 'all');
    return {
      todayAll,
      attentionAll: attentionItems(data, now, 'all').length,
      today: eventsOnDay(data.events, now, filter),
      upcoming: upcomingByDay(data.events, now, filter),
      attention: attentionItems(data, now, filter),
    };
  }, [data, now, filter]);
  const next = nextUp(view.todayAll, now);

  const summary = (
    <>
      <p className="masthead__date">
        {formatLongDate(now)}
        {' · '}
        {view.attentionAll > 0 ? (
          <a href="#attention">{view.attentionAll} {view.attentionAll === 1 ? 'needs' : 'need'} attention</a>
        ) : (
          <span className="masthead__calm">everything is covered</span>
        )}
      </p>
      {next && (
        <p className="masthead__next">
          <strong>{next.status === 'now' ? 'Now' : `Next, ${formatTime(parseLocal(next.event.start))}`}</strong> {next.event.title}
        </p>
      )}
    </>
  );

  return (
    <Shell chrome={chrome} eyebrow="The Cottage" heading={`${greeting(now)}, ${me?.name ?? 'there'}.`} summary={summary}>
      <div className="board-layout">
        <div className="board-layout__filter">
          <MemberFilter members={data.members} value={filter} onChange={setFilter} />
        </div>
        <div className="board-layout__primary">
          <NeedsAttention
            items={view.attention}
            members={data.members}
            events={data.events}
            unavailable={data.unavailable}
            viewingAs={chrome.viewingAs}
            today={now}
            filterName={filterName}
            viewingAsName={me?.name ?? 'you'}
            onAct={actions.onAttentionAct}
            onUndo={actions.onAttentionUndo}
            coverageTracked={coverageTracked}
          />
          <TodayTimeline events={view.today} members={data.members} now={now} filterName={filterName} />
          <button type="button" className="link-btn schedule-link" onClick={actions.onUpdateSchedule}>Update my schedule</button>
        </div>
        <div className="board-layout__secondary">
          <MailCard mail={data.mailCheck} members={data.members} viewingAs={me} now={now} onCheck={actions.onMailCheck} onUndo={actions.onMailUndo} />
          <UpcomingList groups={view.upcoming} members={data.members} today={now} filterName={filterName} />
        </div>
      </div>
    </Shell>
  );
}
