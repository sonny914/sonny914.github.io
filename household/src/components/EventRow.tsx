import type { HouseholdEvent, HouseholdMember } from '../data/types';
import { formatTime, parseLocal } from '../lib/dates';
import { type EventStatus, responsibleNames } from '../lib/schedule';
import { AvatarStack } from './Avatar';
import { CategoryTag } from './CategoryTag';
import { AlertIcon, CheckIcon, PinIcon } from './Icons';

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export function EventRow({
  event,
  members,
  status,
  showTime = true,
}: {
  event: HouseholdEvent;
  members: HouseholdMember[];
  status?: EventStatus;
  showTime?: boolean;
}) {
  const start = parseLocal(event.start);
  const end = event.end ? parseLocal(event.end) : undefined;
  const timeLabel = event.allDay ? 'All day' : formatTime(start);
  const timeSub = !event.allDay && end ? `to ${formatTime(end)}` : '';
  const resp = event.responsibleAdultIds;
  const selfOwned = sameSet(resp, event.participantIds);
  const participantNames = responsibleNames(event.participantIds, members).join(', ');
  const needsConfirm = event.confirmation.state === 'pending';

  return (
    <li className="event" data-category={event.category} data-status={status}>
      {showTime && (
        <div className="event-time">
          <span className="event-time-main">{timeLabel}</span>
          {timeSub && <span className="event-time-sub">{timeSub}</span>}
        </div>
      )}
      <div className="event-card">
        <div className="event-head">
          <CategoryTag category={event.category} />
          {status === 'now' && <span className="flag flag-now">Happening now</span>}
          {status === 'done' && (
            <span className="flag flag-done">
              <CheckIcon size={14} /> Done
            </span>
          )}
        </div>
        <h4 className="event-title">{event.title}</h4>
        {event.location && (
          <p className="event-meta">
            <PinIcon size={15} /> {event.location}
          </p>
        )}
        <div className="who">
          {event.participantIds.length > 0 && (
            <span className="who-for">
              <AvatarStack ids={event.participantIds} members={members} />
              <span>{participantNames}</span>
            </span>
          )}
          {resp.length === 0 ? (
            <span className="flag flag-warn">
              <AlertIcon size={14} /> No one assigned
            </span>
          ) : (
            !selfOwned && <span className="who-resp">{responsibleNames(resp, members).join(' & ')} responsible</span>
          )}
          {needsConfirm && (
            <span className="flag flag-warn">
              <AlertIcon size={14} /> Needs confirming
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
