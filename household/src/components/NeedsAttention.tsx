import { useState } from 'react';
import type { HouseholdMember } from '../data/types';
import { formatDay, formatWhen } from '../lib/dates';
import type { AttentionItem, AttentionKind } from '../lib/schedule';
import { AvatarStack } from './Avatar';
import { AlertIcon, CheckIcon, ClockIcon, PersonPlusIcon } from './Icons';
import { EmptyState } from './EmptyState';

const KIND: Record<AttentionKind, { label: string; Icon: typeof AlertIcon }> = {
  coverage: { label: 'Needs coverage', Icon: PersonPlusIcon },
  confirmation: { label: 'Needs confirming', Icon: CheckIcon },
  overdue: { label: 'Overdue', Icon: ClockIcon },
};

export function NeedsAttention({
  items,
  members,
  today,
  filterName,
}: {
  items: AttentionItem[];
  members: HouseholdMember[];
  today: Date;
  filterName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 3;
  const shown = expanded ? items : items.slice(0, LIMIT);
  const hidden = items.length - shown.length;
  return (
    <section className="section attention" aria-labelledby="attn-h">
      <h2 id="attn-h" className="section-title">
        Needs attention
        {items.length > 0 && <span className="count" aria-label={`${items.length} items`}>{items.length}</span>}
      </h2>
      {items.length === 0 ? (
        <EmptyState tone="good" title={filterName ? `Nothing needs ${filterName}` : 'Everything is covered'}>
          No open coverage, confirmations or overdue tasks.
        </EmptyState>
      ) : (
        <ul className="attn-list">
          {shown.map((item) => {
            const { label, Icon } = KIND[item.kind];
            return (
              <li key={item.id} className="attn-item" data-kind={item.kind}>
                <span className="attn-icon"><Icon size={20} /></span>
                <div className="attn-body">
                  <p className="attn-kind">{label}</p>
                  <p className="attn-title">{item.title}</p>
                  <p className="attn-detail">{item.detail}</p>
                  <p className="attn-when">
                    {item.allDay ? `${formatDay(item.at, today)}, all day` : formatWhen(item.at, today)}
                    <AvatarStack ids={item.memberIds} members={members} />
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {items.length > LIMIT && (
        <button type="button" className="btn btn-quiet attn-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show fewer' : `Show ${hidden} more`}
        </button>
      )}
    </section>
  );
}
