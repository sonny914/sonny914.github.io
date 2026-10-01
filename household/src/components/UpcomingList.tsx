import type { HouseholdEvent, HouseholdMember } from '../data/types';
import { dayParts } from '../lib/dates';
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
    <section className="section section--upcoming" aria-labelledby="upcoming-h">
      <h2 id="upcoming-h" className="section__title">Next 7 days</h2>
      {groups.length === 0 ? (
        <EmptyState title={filterName ? `Nothing coming up for ${filterName}` : 'Nothing on the board this week'}>
          New events will appear here as soon as they are added.
        </EmptyState>
      ) : (
        groups.map((g) => {
          const { label, date } = dayParts(g.day, today);
          return (
            <div key={g.day.toISOString()} className="day">
              <h3 className="day__heading">
                {label} <span className="day__date">{date}</span>
              </h3>
              <ul className="board board--compact">
                {g.events.map((e) => (
                  <EventRow key={e.id} event={e} members={members} variant="upcoming" />
                ))}
              </ul>
            </div>
          );
        })
      )}
    </section>
  );
}
