import { useState } from 'react';
import type { AuthService } from '../auth/auth';
import { Avatar } from '../components/Avatar';
import { ChildUpdateForm } from '../components/ChildUpdateForm';
import { ContactForm } from '../components/ContactForm';
import { EmptyState } from '../components/EmptyState';
import { type Chrome, Shell } from '../components/Shell';
import { Sheet } from '../components/Sheet';
import { ShiftForm } from '../components/ShiftForm';
import { UnavailableForm } from '../components/UnavailableForm';
import type { ChildUpdate, HouseholdMember, HouseholdSnapshot, MemberId, TrustedContact, UnavailablePeriod, WorkEntry } from '../data/types';
import { formatWhen, parseLocal } from '../lib/dates';
import { attribution, inputToPeriod, inputToUpdate, shiftToEntry } from '../lib/records';
import { describeWorkEntry, updateTypeLabel } from '../lib/schedules';

export type HouseholdView = { kind: 'list' } | { kind: 'person'; id: MemberId } | { kind: 'contact'; id: string };

export interface ProfileActions {
  /** Every save/delete resolves to whether it was stored. Forms stay open when it was not. */
  saveWork: (e: WorkEntry) => Promise<boolean>;
  deleteWork: (id: string) => Promise<boolean>;
  saveUnavailable: (u: UnavailablePeriod) => Promise<boolean>;
  deleteUnavailable: (id: string) => Promise<boolean>;
  saveUpdate: (u: ChildUpdate) => Promise<boolean>;
  deleteUpdate: (id: string) => Promise<boolean>;
  saveContact: (id: string, patch: Partial<TrustedContact>) => Promise<boolean>;
  /** Demo: forget who you are on this device. Account: sign out. */
  switchPerson: () => void;
}

type Editing =
  | { kind: 'shift'; entry?: WorkEntry }
  | { kind: 'away'; period?: UnavailablePeriod }
  | { kind: 'update'; update?: ChildUpdate }
  | { kind: 'contact' };

export function HouseholdScreen({
  data,
  now,
  chrome,
  auth,
  email,
  canReviewImport,
  onReviewImport,
  view,
  onView,
  actions,
}: {
  data: HouseholdSnapshot;
  now: Date;
  chrome: Chrome;
  auth: AuthService;
  email?: string;
  /** Account mode, with demo records still saved in this browser. */
  canReviewImport: boolean;
  onReviewImport: () => void;
  view: HouseholdView;
  onView: (v: HouseholdView) => void;
  actions: ProfileActions;
}) {
  const me = data.members.find((m) => m.id === chrome.viewingAs);
  const person = view.kind === 'person' ? data.members.find((m) => m.id === view.id) : undefined;
  const contact = view.kind === 'contact' ? data.trustedContacts.find((c) => c.id === view.id) : undefined;

  const heading = person ? person.name : contact ? contact.name : 'Household';
  const summary =
    person ? <p>{person.role === 'adult' ? 'Adult' : 'Child'}</p>
    : contact ? <p>{contact.role}</p>
    : <p>People, schedules and trusted contacts.</p>;

  return (
    <Shell chrome={chrome} eyebrow="The Cottage" heading={heading} summary={summary}>
      {view.kind === 'list' && <PeopleList data={data} me={me} auth={auth} email={email} canReviewImport={canReviewImport} onReviewImport={onReviewImport} onView={onView} onSwitch={actions.switchPerson} />}
      {person && person.role === 'adult' && (
        <AdultProfile data={data} now={now} person={person} me={me} onBack={() => onView({ kind: 'list' })} actions={actions} />
      )}
      {person && person.role === 'child' && (
        <ChildProfile data={data} now={now} person={person} me={me} onBack={() => onView({ kind: 'list' })} actions={actions} />
      )}
      {contact && <ContactProfile contact={contact} data={data} now={now} onBack={() => onView({ kind: 'list' })} actions={actions} />}
    </Shell>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" className="link-btn back" onClick={onBack}>← Household</button>
  );
}

// ---- List -------------------------------------------------------------------

function PeopleList({
  data,
  me,
  auth,
  email,
  canReviewImport,
  onReviewImport,
  onView,
  onSwitch,
}: {
  data: HouseholdSnapshot;
  me?: HouseholdMember;
  auth: AuthService;
  email?: string;
  canReviewImport: boolean;
  onReviewImport: () => void;
  onView: (v: HouseholdView) => void;
  onSwitch: () => void;
}) {
  const summaryFor = (m: HouseholdMember): string => {
    if (m.role === 'adult') {
      const n = data.workEntries.filter((e) => e.memberId === m.id).length;
      return n ? `${n} schedule ${n === 1 ? 'entry' : 'entries'}` : 'No schedule entered yet';
    }
    const n = data.childUpdates.filter((u) => u.childIds.includes(m.id)).length;
    return n ? `${n} ${n === 1 ? 'update' : 'updates'}` : 'No updates yet';
  };
  return (
    <>
      <section className="section" aria-labelledby="people-h">
        <h2 id="people-h" className="section__title">People</h2>
        <ul className="people">
          {data.members.map((m) => (
            <li key={m.id}>
              <button type="button" className="person-row" onClick={() => onView({ kind: 'person', id: m.id })}>
                <Avatar member={m} size={36} />
                <span className="person-row__text">
                  <span className="person-row__name">{m.name}{m.id === me?.id ? ' (you)' : ''}</span>
                  <span className="person-row__meta">{m.role === 'adult' ? 'Adult' : 'Child'} · {summaryFor(m)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="trusted-h">
        <h2 id="trusted-h" className="section__title">Trusted contacts</h2>
        <ul className="people">
          {data.trustedContacts.map((c) => (
            <li key={c.id}>
              <button type="button" className="person-row" onClick={() => onView({ kind: 'contact', id: c.id })}>
                <span className="avatar avatar--contact" aria-hidden="true">{c.name.charAt(0)}</span>
                <span className="person-row__text">
                  <span className="person-row__name">{c.name}</span>
                  <span className="person-row__meta">{c.role} · {c.phone || c.email ? 'Details added' : 'No contact details yet'}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="account-h">
        <h2 id="account-h" className="section__title">This device</h2>
        {auth.kind === 'demo' ? (
          <>
            <p className="account__who">Using The Cottage as <strong>{me?.name}</strong>.</p>
            <p className="account__note">
              Demo mode: this is a name saved in this browser, not a sign-in. Schedules and updates are saved on this device only and are not shared with the other adults yet.
            </p>
          </>
        ) : (
          <>
            <p className="account__who">Signed in as <strong>{me?.name}</strong>{email ? ` (${email})` : ''}.</p>
            <p className="account__note">Everything you save here is shared with the other adults, and shows that you made the change.</p>
          </>
        )}
        {canReviewImport && (
          <p className="account__note">
            This browser still holds records saved in demo mode. They have not been uploaded.{' '}
            <button type="button" className="link-btn" onClick={onReviewImport}>Review records on this device</button>
          </p>
        )}
        <button type="button" className="btn btn-quiet" onClick={onSwitch}>{auth.kind === 'demo' ? 'Switch person' : 'Sign out'}</button>
      </section>
    </>
  );
}

// ---- Adult ------------------------------------------------------------------

function AdultProfile({
  data,
  now,
  person,
  me,
  onBack,
  actions,
}: {
  data: HouseholdSnapshot;
  now: Date;
  person: HouseholdMember;
  me?: HouseholdMember;
  onBack: () => void;
  actions: ProfileActions;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const mine = person.id === me?.id;
  const entries = data.workEntries.filter((e) => e.memberId === person.id);
  const periods = data.unavailable.filter((u) => u.memberId === person.id);
  const close = () => setEditing(null);

  return (
    <>
      <BackButton onBack={onBack} />
      {!mine && <p className="account__note">Only {person.name} can change {person.name}’s schedule. You’re viewing it.</p>}

      <section className="section" aria-labelledby="sched-h">
        <h2 id="sched-h" className="section__title">Work schedule</h2>
        {entries.length === 0 ? (
          <EmptyState title="No schedule entered yet">
            {mine ? 'Add your shifts so the household can see when you’re at work.' : `${person.name} hasn’t added shifts yet.`}
          </EmptyState>
        ) : (
          <ul className="entries">
            {entries.map((e) => (
              <li key={e.id} className="entry">
                <div>
                  <p className="entry__title">{describeWorkEntry(e)}</p>
                  <p className="entry__meta">{attribution(e, data.members, now)}</p>
                </div>
                {mine && <button type="button" className="btn btn-quiet" aria-label={`Edit shift ${describeWorkEntry(e)}`} onClick={() => setEditing({ kind: 'shift', entry: e })}>Edit</button>}
              </li>
            ))}
          </ul>
        )}
        {mine && (
          <button type="button" className="btn btn-quiet entries__add" onClick={() => setEditing({ kind: 'shift' })}>
            {entries.length ? 'Add a shift' : 'Update my schedule'}
          </button>
        )}
        {mine && <p className="account__note">Photo and PDF upload, and reading a posted schedule, come in the next update.</p>}
      </section>

      <section className="section" aria-labelledby="away-h">
        <h2 id="away-h" className="section__title">Unavailable times</h2>
        {periods.length === 0 ? (
          <EmptyState title="Nothing marked">{mine ? 'Add trips, appointments or any time you can’t cover.' : `${person.name} hasn’t marked any time.`}</EmptyState>
        ) : (
          <ul className="entries">
            {periods.map((u) => (
              <li key={u.id} className="entry">
                <div>
                  <p className="entry__title">{describePeriod(u)}</p>
                  {u.note && <p className="entry__note">{u.note}</p>}
                  <p className="entry__meta">{attribution(u, data.members, now)}</p>
                </div>
                {mine && <button type="button" className="btn btn-quiet" aria-label={`Edit unavailable time ${describePeriod(u)}`} onClick={() => setEditing({ kind: 'away', period: u })}>Edit</button>}
              </li>
            ))}
          </ul>
        )}
        {mine && <button type="button" className="btn btn-quiet entries__add" onClick={() => setEditing({ kind: 'away' })}>Add unavailable time</button>}
      </section>

      {editing?.kind === 'shift' && (
        <Sheet title={editing.entry ? 'Edit shift' : 'Add a shift'} onClose={close}>
          <ShiftForm
            entry={editing.entry}
            onCancel={close}
            onSave={async (i) => { if (await actions.saveWork(shiftToEntry(i, person.id, me?.id ?? person.id, now, editing.entry))) close(); }}
            onDelete={editing.entry ? async () => { if (await actions.deleteWork(editing.entry!.id)) close(); } : undefined}
          />
        </Sheet>
      )}
      {editing?.kind === 'away' && (
        <Sheet title={editing.period ? 'Edit unavailable time' : 'Add unavailable time'} onClose={close}>
          <UnavailableForm
            period={editing.period}
            onCancel={close}
            onSave={async (i) => { if (await actions.saveUnavailable(inputToPeriod(i, person.id, me?.id ?? person.id, now, editing.period))) close(); }}
            onDelete={editing.period ? async () => { if (await actions.deleteUnavailable(editing.period!.id)) close(); } : undefined}
          />
        </Sheet>
      )}
    </>
  );
}

function describePeriod(u: UnavailablePeriod): string {
  const day = (s: string) => parseLocal(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = (s: string) => parseLocal(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const sameDay = u.start.slice(0, 10) === u.end.slice(0, 10);
  if (u.allDay) return sameDay ? `${day(u.start)} · all day` : `${day(u.start)} to ${day(u.end)} · all day`;
  return sameDay ? `${day(u.start)} · ${time(u.start)} to ${time(u.end)}` : `${day(u.start)} ${time(u.start)} to ${day(u.end)} ${time(u.end)}`;
}

// ---- Child ------------------------------------------------------------------

function ChildProfile({
  data,
  now,
  person,
  me,
  onBack,
  actions,
}: {
  data: HouseholdSnapshot;
  now: Date;
  person: HouseholdMember;
  me?: HouseholdMember;
  onBack: () => void;
  actions: ProfileActions;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const kids = data.members.filter((m) => m.role === 'child');
  const updates = data.childUpdates
    .filter((u) => u.childIds.includes(person.id))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const nameOf = (id: MemberId) => data.members.find((m) => m.id === id)?.name ?? 'Someone';
  const close = () => setEditing(null);

  return (
    <>
      <BackButton onBack={onBack} />
      <section className="section" aria-labelledby="upd-h">
        <h2 id="upd-h" className="section__title">Updates</h2>
        {updates.length === 0 ? (
          <EmptyState title={`No updates for ${person.name} yet`}>School notes, appointments, therapy and reminders any adult adds will show here.</EmptyState>
        ) : (
          <ul className="entries">
            {updates.map((u) => (
              <li key={u.id} className="entry">
                <div>
                  <p className="entry__title">{u.title}</p>
                  <p className="entry__meta">
                    {updateTypeLabel(u.type)}
                    {u.at && ` · ${formatWhen(parseLocal(u.at), now)}`}
                    {u.childIds.length > 1 && ` · For ${u.childIds.map(nameOf).join(' and ')}`}
                  </p>
                  {u.note && <p className="entry__note">{u.note}</p>}
                  <p className="entry__meta">{attribution(u, data.members, now)}</p>
                </div>
                <button type="button" className="btn btn-quiet" aria-label={`Edit ${u.title}`} onClick={() => setEditing({ kind: 'update', update: u })}>Edit</button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn btn-quiet entries__add" onClick={() => setEditing({ kind: 'update' })}>Add an update</button>
      </section>

      {editing?.kind === 'update' && (
        <Sheet title={editing.update ? 'Edit update' : `Add an update for ${person.name}`} onClose={close}>
          <ChildUpdateForm
            kids={kids}
            startWith={person.id}
            update={editing.update}
            onCancel={close}
            onSave={async (i) => { if (await actions.saveUpdate(inputToUpdate(i, me?.id ?? person.id, now, editing.update))) close(); }}
            onDelete={editing.update ? async () => { if (await actions.deleteUpdate(editing.update!.id)) close(); } : undefined}
          />
        </Sheet>
      )}
    </>
  );
}

// ---- Trusted contact --------------------------------------------------------

function ContactProfile({
  contact,
  data,
  now,
  onBack,
  actions,
}: {
  contact: TrustedContact;
  data: HouseholdSnapshot;
  now: Date;
  onBack: () => void;
  actions: ProfileActions;
}) {
  const [editing, setEditing] = useState(false);
  const by = contact.updatedBy ? data.members.find((m) => m.id === contact.updatedBy)?.name : undefined;
  return (
    <>
      <BackButton onBack={onBack} />
      <section className="section" aria-labelledby="contact-h">
        <h2 id="contact-h" className="section__title">Contact details</h2>
        {contact.relationship && <p className="account__who">{contact.relationship}.</p>}
        <dl className="details">
          <dt>Phone</dt>
          <dd>{contact.phone || <span className="details__empty">Not added yet</span>}</dd>
          <dt>Email</dt>
          <dd>{contact.email || <span className="details__empty">Not added yet</span>}</dd>
          {contact.notes && (<><dt>Notes</dt><dd>{contact.notes}</dd></>)}
        </dl>
        {by && contact.updatedAt && <p className="entry__meta">Last edited by {by}, {formatWhen(parseLocal(contact.updatedAt), now)}</p>}
        <button type="button" className="btn btn-quiet entries__add" onClick={() => setEditing(true)}>
          {contact.phone || contact.email ? 'Edit details' : 'Add contact details'}
        </button>
        <p className="account__note callout">
          <strong>Calling or messaging {contact.name} is not confirmed childcare.</strong> A pickup stays open on the board until an adult records who is covering it. {contact.name}’s availability is never assumed.
        </p>
      </section>
      {editing && (
        <Sheet title={`${contact.name}’s details`} onClose={() => setEditing(false)}>
          <ContactForm
            contact={contact}
            onCancel={() => setEditing(false)}
            onSave={async (patch) => { if (await actions.saveContact(contact.id, patch)) setEditing(false); }}
          />
        </Sheet>
      )}
    </>
  );
}
