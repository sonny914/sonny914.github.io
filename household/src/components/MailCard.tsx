import type { HouseholdMember, MailCheck } from '../data/types';
import { formatWhen, parseLocal } from '../lib/dates';
import { mailNeedsCheck, mailOverdue } from '../lib/schedule';
import { Avatar } from './Avatar';
import { CheckIcon, MailIcon } from './Icons';

/** The physical mailbox: a ruled strip, not a card. Attribution follows "Viewing as". */
export function MailCard({
  mail,
  members,
  viewingAs,
  now,
  onCheck,
  onUndo,
}: {
  mail: MailCheck;
  members: HouseholdMember[];
  viewingAs: HouseholdMember | undefined;
  now: Date;
  onCheck: () => void;
  onUndo: () => void;
}) {
  const checkedAt = parseLocal(mail.checkedAt);
  const needs = mailNeedsCheck(checkedAt, now);
  const overdue = needs && mailOverdue(checkedAt, now);
  const lastBy = members.find((m) => m.id === mail.checkedBy);

  return (
    <section className="mail" data-state={needs ? 'needs' : 'done'} aria-labelledby="mail-h">
      <span className="mail__icon">{needs ? <MailIcon size={22} /> : <CheckIcon size={22} />}</span>
      <div className="mail__text">
        <h2 id="mail-h" className="mail__title">{needs ? 'Mail needs to be checked' : 'Mail is checked'}</h2>
        <p className="mail__last" aria-live="polite">
          {lastBy && <Avatar member={lastBy} size={20} />}
          <span>
            Last checked by <strong>{lastBy?.name ?? 'someone'}</strong> · {formatWhen(checkedAt, now)}
          </span>
        </p>
      </div>
      {needs ? (
        <div className="mail__action">
          <button type="button" className={`btn ${overdue ? 'btn-primary' : 'btn-quiet'}`} onClick={onCheck}>Mark as checked</button>
          {viewingAs && <p className="mail__as">Saved as {viewingAs.name}</p>}
        </div>
      ) : (
        <div className="mail__action">
          <button type="button" className="link-btn" onClick={onUndo}>Undo</button>
        </div>
      )}
    </section>
  );
}
