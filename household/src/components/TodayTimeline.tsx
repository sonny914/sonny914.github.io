import type { HouseholdEvent, HouseholdMember } from '../data/types';
import { eventStatus } from '../lib/schedule';
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
  return (
    <section className="section" aria-labelledby="today-h">
      <h2 id="today-h" className="section-title">Today</h2>
      {events.length === 0 ? (
        <EmptyState title={filterName ? `Nothing on for ${filterName} today` : 'A clear day'}>
          {filterName ? 'Pick Everyone to see the rest of the household.' : 'Nothing is scheduled. Use Add to put something on the calendar.'}
        </EmptyState>
      ) : (
        <ol className="timeline">
          {events.map((e) => (
            <EventRow key={e.id} event={e} members={members} status={eventStatus(e, now)} />
          ))}
        </ol>
      )}
    </section>
  );
}
