import type { HouseholdMember } from '../data/types';
import type { MemberFilter as Filter } from '../lib/schedule';
import { Avatar } from './Avatar';

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
      <div className="filter" role="group" aria-label="Show events for">
        <button type="button" className="chip" aria-pressed={value === 'all'} onClick={() => onChange('all')}>
          Everyone
        </button>
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            className="chip"
            data-color={m.color}
            aria-pressed={value === m.id}
            onClick={() => onChange(value === m.id ? 'all' : m.id)}
          >
            <Avatar member={m} size={24} />
            {m.name}
          </button>
        ))}
      </div>
    </div>
  );
}
