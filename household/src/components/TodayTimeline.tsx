import { useState } from 'react';
import type { HouseholdEvent, HouseholdMember } from '../data/types';
import { eventStatus, nextUp } from '../lib/schedule';
import { EmptyState } from './EmptyState';
import { EventRow } from './EventRow';

export function TodayTimeline({
  events,
  members,
  now,
  filterName,
}: {
  events: HouseholdEvent[];
  members: HouseholdMember[];
  now: Date;
  filterName?: string;
}) {
  const [showDone, setShowDone] = useState(false);
  const rows = events.map((e) => ({ e, status: eventStatus(e, now) }));
  const doneCount = rows.filter((r) => r.status === 'done').length;
  const visible = showDone ? rows : rows.filter((r) => r.status !== 'done');
  const nextId = nextUp(events, now)?.event.id;

  return (
    <section className="section" aria-labelledby="today-h">
      <h2 id="today-h" className="section-title">Today</h2>
      {events.length === 0 ? (
        <EmptyState title={filterName ? `Nothing on for ${filterName} today` : 'A clear day'}>
          {filterName ? 'Pick Everyone to see the rest of the household.' : 'Nothing is scheduled. Use Add to put something on the calendar.'}
        </EmptyState>
      ) : (
        <>
          {doneCount > 0 && (
            <button type="button" className="btn btn-quiet done-toggle" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
              {showDone ? 'Hide earlier events' : `Show ${doneCount} earlier today`}
            </button>
          )}
          <ol className="timeline">
            {visible.map(({ e, status }) => (
              <EventRow key={e.id} event={e} members={members} status={status} isNext={e.id === nextId} />
            ))}
          </ol>
          {visible.length === 0 && (
            <EmptyState tone="good" title="That’s everything for today">
              Nothing else is scheduled.
            </EmptyState>
          )}
        </>
      )}
    </section>
  );
}
