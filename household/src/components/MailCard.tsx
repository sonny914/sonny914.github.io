import { useState } from 'react';
import type { HouseholdMember, MailCheck, MemberId } from '../data/types';
import { formatWhen, parseLocal } from '../lib/dates';
import { mailNeedsCheck } from '../lib/schedule';
import { Avatar } from './Avatar';
import { CheckIcon, MailIcon } from './Icons';

export function MailCard({
  mail,
  adults,
  now,
  onCheck,
  onUndo,
}: {
  mail: MailCheck;
  adults: HouseholdMember[];
  now: Date;
  onCheck: (by: MemberId) => void;
  onUndo: () => void;
}) {
  // Demo stand-in for "who is signed in" until real accounts exist.
  const [actingId, setActingId] = useState<MemberId>(adults[0]?.id ?? '');
  const checkedAt = parseLocal(mail.checkedAt);
  const needs = mailNeedsCheck(checkedAt, now);
  const lastBy = adults.find((m) => m.id === mail.checkedBy);

  return (
    <section className="section" aria-labelledby="mail-h">
      <div className="mail" data-state={needs ? 'needs' : 'done'}>
        <div className="mail-top">
          <span className="mail-icon">{needs ? <MailIcon size={24} /> : <CheckIcon size={24} />}</span>
          <div>
            <h2 id="mail-h" className="mail-title">{needs ? 'Mail needs to be checked' : 'Mail is checked'}</h2>
            <p className="mail-last" aria-live="polite">
              {lastBy && <Avatar member={lastBy} size={20} />}
              <span>
                Last checked by <strong>{lastBy?.name ?? 'someone'}</strong>
                {' · '}
                {formatWhen(checkedAt, now)}
              </span>
            </p>
          </div>
        </div>
        {needs ? (
          <div className="mail-actions">
            <button type="button" className="btn btn-primary" onClick={() => onCheck(actingId)}>
              Mark as checked
            </button>
            <label className="mail-as">
              <span>As</span>
              <select value={actingId} onChange={(e) => setActingId(e.target.value)}>
                {adults.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div className="mail-actions">
            <p className="mail-note">Nothing more to do today.</p>
            <button type="button" className="btn btn-quiet" onClick={onUndo}>Undo</button>
          </div>
        )}
      </div>
    </section>
  );
}
