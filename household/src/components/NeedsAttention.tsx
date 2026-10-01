import { useEffect, useState } from 'react';
import { formatDay, formatWhen } from '../lib/dates';
import type { AttentionItem, AttentionKind } from '../lib/schedule';
import { AlertIcon, CheckIcon, ClockIcon, PersonPlusIcon } from './Icons';

const KIND: Record<AttentionKind, { label: string; action: string; Icon: typeof AlertIcon }> = {
  coverage: { label: 'Needs coverage', action: 'I’ll cover', Icon: PersonPlusIcon },
  confirmation: { label: 'Needs confirming', action: 'Confirm', Icon: CheckIcon },
  overdue: { label: 'Overdue', action: 'Done', Icon: ClockIcon },
};

const LIMIT = 2;
const UNDO_MS = 10_000;

/** The one loud block on the page: everything here needs a person to act. */
export function NeedsAttention({
  items,
  today,
  filterName,
  viewingAsName,
  onAct,
  onUndo,
}: {
  items: AttentionItem[];
  today: Date;
  filterName?: string;
  viewingAsName: string;
  onAct: (item: AttentionItem) => void;
  onUndo: (item: AttentionItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [last, setLast] = useState<{ item: AttentionItem; message: string } | null>(null);
  useEffect(() => {
    if (!last) return;
    const t = setTimeout(() => setLast(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [last]);
  const shown = expanded ? items : items.slice(0, LIMIT);

  function act(item: AttentionItem) {
    onAct(item);
    setLast({
      item,
      message:
      item.kind === 'coverage'
        ? `${viewingAsName} will cover “${item.title}”.`
        : item.kind === 'confirmation'
          ? `“${item.title}” confirmed.`
          : `“${item.title}” marked done.`,
    });
  }

  return (
    <section className={`section attention${items.length === 0 ? ' attention--clear' : ''}`} aria-labelledby="attn-h" id="attention">
      <h2 id="attn-h" className="attention__title">
        <AlertIcon size={18} /> Needs attention
        {items.length > 0 && <span className="attention__count">{items.length}</span>}
      </h2>
      {last && (
        <p className="attention__undo" role="status">
          {last.message}
          <button type="button" className="attention__undo-btn" onClick={() => { onUndo(last.item); setLast(null); }}>Undo</button>
        </p>
      )}
      {items.length === 0 ? (
        <p className="attention__clear">
          <strong>{filterName ? `Nothing needs ${filterName}.` : 'Everything is covered.'}</strong>{' '}
          Open coverage, confirmations and overdue tasks will show up here.
        </p>
      ) : (
        <ul className="attention__list">
          {shown.map((item) => {
            const { label, action, Icon } = KIND[item.kind];
            return (
              <li key={item.id} className="attention__item" data-kind={item.kind}>
                <div className="attention__text">
                  <p className="attention__kind">
                    <Icon size={14} /> {label}
                    <span className="attention__when">
                      {item.allDay ? `${formatDay(item.at, today)}, all day` : formatWhen(item.at, today)}
                    </span>
                  </p>
                  <p className="attention__what">{item.title}</p>
                  <p className="attention__detail">{item.detail}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-quiet"
                  aria-label={`${action}: ${item.title}${item.kind === 'coverage' ? `, as ${viewingAsName}` : ''}`}
                  onClick={() => act(item)}
                >
                  {action}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {items.length > LIMIT && (
        <button type="button" className="attention__more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show fewer' : `Show ${items.length - LIMIT} more`}
        </button>
      )}
    </section>
  );
}
