import type { HouseholdEvent, HouseholdMember } from '../data/types';
import { formatDayHeading } from '../lib/dates';
import { EmptyState } from './EmptyState';
import { EventRow } from './EventRow';

export function UpcomingList({
  groups,
  members,
  today,
  filterName,
}: {
  groups: { day: Date; events: HouseholdEvent[] }[];
  members: HouseholdMember[];
  today: Date;
  filterName?: string;
}) {
  return (
    <section className="section" aria-labelledby="upcoming-h">
      <h2 id="upcoming-h" className="section-title">
        Coming up <span className="section-note">next 7 days</span>
      </h2>
      {groups.length === 0 ? (
        <EmptyState title={filterName ? `Nothing coming up for ${filterName}` : 'Nothing coming up this week'}>
          New events will show here as soon as they are added.
        </EmptyState>
      ) : (
        groups.map((g) => (
          <div key={g.day.toISOString()} className="day-group">
            <h3 className="day-heading">{formatDayHeading(g.day, today)}</h3>
            <ul className="timeline timeline-compact">
              {g.events.map((e) => (
                <EventRow key={e.id} event={e} members={members} />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
