import type { DemoState } from '../data/demoState';
import type { ChildUpdate, HouseholdMember, HouseholdSnapshot, MemberId, TrustedContact, UnavailablePeriod, WorkEntry } from '../data/types';
import { describeWorkEntry, updateTypeLabel } from '../lib/schedules';

/**
 * Records saved in this browser by the single-device demo can be moved into the shared household, but only
 * after a person reviews them and chooses which. Nothing here uploads anything; it only describes what
 * could be imported and what cannot (and why). Importing writes new records attributed to the signed-in
 * account, not to whoever the demo said created them.
 */
export type ImportRecord =
  | { kind: 'work'; entry: WorkEntry }
  | { kind: 'away'; period: UnavailablePeriod }
  | { kind: 'update'; update: ChildUpdate }
  | { kind: 'contact'; id: string; patch: Pick<TrustedContact, 'phone' | 'email' | 'notes'> };

export interface ImportItem {
  key: string;
  title: string;
  detail: string;
  record: ImportRecord;
  /** Present when this account cannot import it, with the reason in plain words. */
  blocked?: string;
}

const nameOf = (members: HouseholdMember[], id: MemberId) => members.find((m) => m.id === id)?.name ?? 'someone else';

function describeAway(u: UnavailablePeriod): string {
  const d = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return u.start.slice(0, 10) === u.end.slice(0, 10) ? `${d(u.start)}${u.allDay ? ' · all day' : ''}` : `${d(u.start)} to ${d(u.end)}`;
}

export function buildImportPlan(local: DemoState, me: MemberId, shared: HouseholdSnapshot): ImportItem[] {
  const members = shared.members;
  const items: ImportItem[] = [];

  for (const e of local.workEntries) {
    const mine = e.memberId === me;
    const there = shared.workEntries.some((x) => x.id === e.id);
    items.push({
      key: `work:${e.id}`,
      title: `Work schedule: ${describeWorkEntry(e)}`,
      detail: mine ? `For ${nameOf(members, e.memberId)}.` : `For ${nameOf(members, e.memberId)}.`,
      record: { kind: 'work', entry: e },
      blocked: there ? 'Already in the household.' : mine ? undefined : `Belongs to ${nameOf(members, e.memberId)}. Only ${nameOf(members, e.memberId)} can import it, signed in as themselves.`,
    });
  }

  for (const u of local.unavailable) {
    const mine = u.memberId === me;
    const there = shared.unavailable.some((x) => x.id === u.id);
    items.push({
      key: `away:${u.id}`,
      title: `Unavailable: ${describeAway(u)}${u.note ? ` (${u.note})` : ''}`,
      detail: `For ${nameOf(members, u.memberId)}.`,
      record: { kind: 'away', period: u },
      blocked: there ? 'Already in the household.' : mine ? undefined : `Belongs to ${nameOf(members, u.memberId)}. Only ${nameOf(members, u.memberId)} can import it, signed in as themselves.`,
    });
  }

  for (const u of local.childUpdates) {
    const there = shared.childUpdates.some((x) => x.id === u.id);
    items.push({
      key: `update:${u.id}`,
      title: `${updateTypeLabel(u.type)}: ${u.title}`,
      detail: `About ${u.childIds.map((id) => nameOf(members, id)).join(' and ')}. Will be saved as added by you.`,
      record: { kind: 'update', update: u },
      blocked: there ? 'Already in the household.' : undefined,
    });
  }

  for (const [id, c] of Object.entries(local.contacts)) {
    const current = shared.trustedContacts.find((x) => x.id === id);
    if (!current) continue;
    // Only fill in what is still empty. Never overwrite something an adult already entered.
    const patch: Pick<TrustedContact, 'phone' | 'email' | 'notes'> = {
      phone: !current.phone && c.phone ? c.phone : undefined,
      email: !current.email && c.email ? c.email : undefined,
      notes: !current.notes && c.notes ? c.notes : undefined,
    };
    const adds = (['phone', 'email', 'notes'] as const).filter((f) => patch[f]);
    if (!c.phone && !c.email && !c.notes) continue;
    items.push({
      key: `contact:${id}`,
      title: `${current.name}'s details: ${adds.length ? adds.join(', ') : 'nothing new'}`,
      detail: adds.length ? 'Fills in empty fields only.' : 'Everything here is already in the household.',
      record: { kind: 'contact', id, patch },
      blocked: adds.length ? undefined : 'Already in the household.',
    });
  }
  return items;
}

/** True when this browser holds demo records worth reviewing. */
export function hasLocalRecords(local: DemoState): boolean {
  return (
    local.workEntries.length > 0 ||
    local.unavailable.length > 0 ||
    local.childUpdates.length > 0 ||
    Object.values(local.contacts).some((c) => c.phone || c.email || c.notes)
  );
}
