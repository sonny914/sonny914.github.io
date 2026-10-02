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
  mail: MailCheck | null;
  members: HouseholdMember[];
  viewingAs: HouseholdMember | undefined;
  now: Date;
  onCheck: () => Promise<boolean>;
  onUndo: () => Promise<boolean>;
}) {
  const checkedAt = mail ? parseLocal(mail.checkedAt) : null;
  const needs = !checkedAt || mailNeedsCheck(checkedAt, now);
  const overdue = !!checkedAt && needs && mailOverdue(checkedAt, now);
  const lastBy = mail ? members.find((m) => m.id === mail.checkedBy) : undefined;

  return (
    <section className="mail" data-state={needs ? 'needs' : 'done'} aria-labelledby="mail-h">
      <span className="mail__icon">{needs ? <MailIcon size={22} /> : <CheckIcon size={22} />}</span>
      <div className="mail__text">
        <h2 id="mail-h" className="mail__title">{needs ? 'Mail needs to be checked' : 'Mail is checked'}</h2>
        <p className="mail__last" aria-live="polite">
          {checkedAt ? (
            <>
              {lastBy && <Avatar member={lastBy} size={24} />}
              <span>
                Last checked by <strong>{lastBy?.name ?? 'someone'}</strong> · {formatWhen(checkedAt, now)}
              </span>
            </>
          ) : (
            <span>Nobody has logged a check yet.</span>
          )}
        </p>
      </div>
      {needs ? (
        <div className="mail__action">
          <button type="button" className={`btn ${overdue ? 'btn-primary' : 'btn-quiet'}`} onClick={() => void onCheck()}>Mark as checked</button>
          {viewingAs && <p className="mail__as">Saved as {viewingAs.name}</p>}
        </div>
      ) : (
        <div className="mail__action">
          <button type="button" className="link-btn" onClick={() => void onUndo()}>Undo</button>
        </div>
      )}
    </section>
  );
}
