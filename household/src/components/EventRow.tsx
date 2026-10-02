import type { HouseholdEvent, HouseholdMember } from '../data/types';
import { CATEGORY_LABELS } from '../data/members';
import { formatTime, parseLocal } from '../lib/dates';
import { type EventStatus, isLongBlock } from '../lib/schedule';
import { Person, lookup } from './Avatar';
import { AlertIcon } from './Icons';

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/**
 * One line of the day board: time, then what, where, and who. No boxes.
 * Only things that need a person use colour (brick); everything else is ink.
 */
export function EventRow({
  event,
  members,
  status,
  isNext = false,
  variant = 'today',
}: {
  event: HouseholdEvent;
  members: HouseholdMember[];
  status?: EventStatus;
  isNext?: boolean;
  variant?: 'today' | 'upcoming';
}) {
  const start = parseLocal(event.start);
  const end = event.end ? parseLocal(event.end) : undefined;
  const done = status === 'done';
  // Shifts and daycare are context, not moments to react to.
  const live = status === 'now' && !isLongBlock(event);
  const resp = event.responsibleAdultIds;
  const forWho = lookup(event.participantIds, members);
  const owners = lookup(resp, members);
  const selfOwned = sameSet(resp, event.participantIds);
  const everyone = event.participantIds.length >= members.length - 1 && resp.length > 0;
  const needsConfirm = event.confirmation.state === 'pending' && !done;
  const quiet = event.category === 'work';
  const Title = variant === 'today' ? 'h3' : 'h4';
  const marker = live ? 'Now' : isNext && !live ? 'Up next' : '';

  return (
    <li className="row" data-quiet={quiet || undefined} data-unassigned={(resp.length === 0 && !done) || undefined} data-variant={variant} data-status={live ? 'now' : done ? 'done' : 'later'} data-next={isNext || undefined}>
      <div className="row__time">
        <span className="row__start">{event.allDay ? 'All day' : formatTime(start)}</span>
        {variant === 'today' && !event.allDay && end && <span className="row__end">{formatTime(end)}</span>}
      </div>
      <div className="row__body">
        {marker && <p className="row__marker">{marker}</p>}
        <Title className="row__title">{event.title}</Title>
        <p className="row__meta" hidden={quiet}>
          <span className="row__cat">{CATEGORY_LABELS[event.category]}</span>
          {variant === 'upcoming' && end && !event.allDay && ` · until ${formatTime(end)}`}
          {event.location && !done && ` · ${event.location}`}
        </p>
        {!done && (
          <p className="row__people">
            {quiet && (
              <span className="row__cat">
                {CATEGORY_LABELS[event.category]}
                {variant === 'upcoming' && end && !event.allDay && ` · until ${formatTime(end)}`}
              </span>
            )}
            {everyone ? (
              <span className="person">Everyone</span>
            ) : (
              <>
                {forWho.map((m) => <Person key={m.id} member={m} />)}
                {owners.length > 0 && !selfOwned && (
                  <span className="row__with">
                    {forWho.length > 0 ? 'with' : 'led by'}
                    {owners.map((m) => <Person key={m.id} member={m} />)}
                  </span>
                )}
              </>
            )}
            {resp.length === 0 && (
              <span className="alert-text"><AlertIcon size={15} /> No one assigned</span>
            )}
            {needsConfirm && (
              <span className="alert-text"><AlertIcon size={15} /> Unconfirmed</span>
            )}
          </p>
        )}
      </div>
    </li>
  );
}
