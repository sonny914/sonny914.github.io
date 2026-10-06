import type { HouseholdMember } from '../data/types';
import type { MemberFilter as Filter } from '../lib/schedule';
import { Avatar } from './Avatar';
import { HouseholdIcon } from './Icons';

/**
 * Six equal columns on a phone (avatar over name) so nobody is off-screen;
 * on desktop the same buttons sit in a row with the name beside the avatar.
 * The visible name is the accessible name.
 */
export function MemberFilter({
  members,
  value,
  onChange,
}: {
  members: HouseholdMember[];
  value: Filter;
  onChange: (next: Filter) => void;
}) {
  return (
    <div className="filter-bar">
      <div className="filter" role="group" aria-label="Show schedule for">
        <button type="button" className="tab" aria-pressed={value === 'all'} onClick={() => onChange('all')}>
          <span className="avatar avatar--all" aria-hidden="true"><HouseholdIcon size={16} /></span>
          <span className="tab__name">Everyone</span>
        </button>
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            className="tab"
            aria-pressed={value === m.id}
            onClick={() => onChange(value === m.id ? 'all' : m.id)}
          >
            <Avatar member={m} size={28} />
            <span className="tab__name">{m.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
