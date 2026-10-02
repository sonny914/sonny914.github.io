import type {
  UnavailablePeriod,
  HouseholdEvent,
  HouseholdMember,
  HouseholdSnapshot,
  MemberId,
} from '../data/types';
import { addDays, dayDiff, isSameDay, parseLocal, startOfDay } from './dates';

export type MemberFilter = MemberId | 'all';

export function involvesMember(ids: MemberId[], filter: MemberFilter): boolean {
  return filter === 'all' || ids.includes(filter);
}

export function eventMatches(e: HouseholdEvent, filter: MemberFilter): boolean {
  return involvesMember([...e.participantIds, ...e.responsibleAdultIds], filter);
}

export function compareEvents(a: HouseholdEvent, b: HouseholdEvent): number {
  if (!!a.allDay !== !!b.allDay) return a.allDay ? -1 : 1;
  return parseLocal(a.start).getTime() - parseLocal(b.start).getTime();
}

export function eventsOnDay(events: HouseholdEvent[], day: Date, filter: MemberFilter): HouseholdEvent[] {
  return events
    .filter((e) => isSameDay(parseLocal(e.start), day) && eventMatches(e, filter))
    .sort(compareEvents);
}

/** Tomorrow through seven days out, grouped by day; empty days omitted. */
export function upcomingByDay(
  events: HouseholdEvent[],
  today: Date,
  filter: MemberFilter,
  days = 7,
): { day: Date; events: HouseholdEvent[] }[] {
  const groups: { day: Date; events: HouseholdEvent[] }[] = [];
  for (let i = 1; i <= days; i++) {
    const day = addDays(startOfDay(today), i);
    const list = eventsOnDay(events, day, filter);
    if (list.length) groups.push({ day, events: list });
  }
  return groups;
}

export type EventStatus = 'done' | 'now' | 'later' | 'all-day';

export function eventStatus(e: HouseholdEvent, now: Date): EventStatus {
  if (e.allDay) return 'all-day';
  const start = parseLocal(e.start);
  const end = e.end ? parseLocal(e.end) : start;
  if (now >= end) return 'done';
  if (now >= start) return 'now';
  return 'later';
}

export function responsibleNames(ids: MemberId[], members: HouseholdMember[]): string[] {
  return ids.map((id) => members.find((m) => m.id === id)?.name ?? 'Unknown');
}

// ---- Needs attention --------------------------------------------------------

export interface CoverageWindow {
  start: Date;
  end: Date;
  allDay: boolean;
}

export type AttentionKind = 'coverage' | 'confirmation' | 'overdue';

export interface AttentionItem {
  id: string;
  /** Id of the coverage request, event or reminder an action on this item changes. */
  sourceId: string;
  kind: AttentionKind;
  title: string;
  detail: string;
  /** Machine-readable time the item is about, for sorting and labelling. */
  at: Date;
  allDay: boolean;
  memberIds: MemberId[];
  /** Coverage items only: the time someone has to be there. */
  window?: CoverageWindow;
}

// A child with nobody to collect them outranks a late chore.
const KIND_RANK: Record<AttentionKind, number> = { coverage: 0, confirmation: 1, overdue: 2 };

export function attentionItems(
  data: HouseholdSnapshot,
  now: Date,
  filter: MemberFilter,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const today = startOfDay(now);

  for (const c of data.coverageRequests) {
    if (c.status !== 'open') continue;
    const start = parseLocal(c.start);
    const over = c.allDay ? dayDiff(start, now) < 0 : parseLocal(c.end ?? c.start) < now;
    if (over) continue;
    items.push({
      id: c.id,
      sourceId: c.id,
      kind: 'coverage',
      title: c.title,
      detail: c.reason ?? 'Nobody is assigned yet.',
      at: start,
      allDay: !!c.allDay,
      memberIds: c.forMemberIds,
      window: { start, end: c.end ? parseLocal(c.end) : start, allDay: !!c.allDay },
    });
  }

  for (const e of data.events) {
    if (e.confirmation.state !== 'pending') continue;
    if (parseLocal(e.end ?? e.start) < now && !e.allDay) continue;
    const ids = [...e.participantIds, ...e.responsibleAdultIds];
    if (e.confirmation.assignedTo) ids.push(e.confirmation.assignedTo);
    items.push({
      id: `confirm-${e.id}`,
      sourceId: e.id,
      kind: 'confirmation',
      title: e.title,
      detail: e.confirmation.prompt ?? 'Needs confirming.',
      at: parseLocal(e.start),
      allDay: !!e.allDay,
      memberIds: ids,
    });
  }

  for (const r of data.reminders) {
    if (!r.dueAt || r.completedAt) continue;
    const due = parseLocal(r.dueAt);
    if (due >= now) continue;
    const daysLate = Math.max(1, dayDiff(today, due));
    items.push({
      id: r.id,
      sourceId: r.id,
      kind: 'overdue',
      title: r.title,
      detail: `Was due ${daysLate === 1 ? 'yesterday' : `${daysLate} days ago`}.`,
      at: due,
      allDay: false,
      memberIds: r.assigneeIds,
    });
  }

  return items
    .filter((i) => involvesMember(i.memberIds, filter))
    .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.at.getTime() - b.at.getTime());
}

// ---- Mail ------------------------------------------------------------------

/** Mail is a daily chore: it needs checking until someone has checked it today. */
export function mailNeedsCheck(checkedAt: Date, now: Date): boolean {
  return !isSameDay(checkedAt, now);
}

// ---- What's next -----------------------------------------------------------

/**
 * The next thing that needs a human: the first timed event that is happening
 * now or still to come. Shifts and other long blocks (daycare, school day) run
 * for hours, so they never count as "next".
 */
const LONG_BLOCK_MS = 4 * 3_600_000;

/** Shifts, daycare and school days: background context, not moments to react to. */
export function isLongBlock(e: HouseholdEvent): boolean {
  if (e.category === 'work') return true;
  return !!e.end && parseLocal(e.end).getTime() - parseLocal(e.start).getTime() >= LONG_BLOCK_MS;
}

export function nextUp(events: HouseholdEvent[], now: Date): { event: HouseholdEvent; status: EventStatus } | undefined {
  for (const event of events) {
    if (event.allDay || isLongBlock(event)) continue;
    const status = eventStatus(event, now);
    if (status === 'now' || status === 'later') return { event, status };
  }
  return undefined;
}

// ---- Who can cover? ----------------------------------------------------------

export interface Busy {
  kind: 'work' | 'event' | 'unavailable';
  title: string;
  until: Date;
}

/**
 * Adults tied up during a coverage window. A timed window counts any timed event
 * an adult is responsible for. An all-day window only counts work shifts, since
 * a dentist visit does not stop someone covering a day of care.
 */
export function busyAdults(
  window: CoverageWindow,
  events: HouseholdEvent[],
  adultIds: MemberId[],
  unavailable: UnavailablePeriod[] = [],
): Record<MemberId, Busy> {
  const from = window.allDay ? startOfDay(window.start) : window.start;
  const to = window.allDay ? addDays(from, 1) : window.end;
  const busy: Record<MemberId, Busy> = {};
  for (const e of events) {
    if (e.allDay) continue;
    if (window.allDay && e.category !== 'work') continue;
    const start = parseLocal(e.start);
    const end = e.end ? parseLocal(e.end) : start;
    if (!(start < to && end > from)) continue;
    for (const id of e.responsibleAdultIds) {
      if (!adultIds.includes(id)) continue;
      const prev = busy[id];
      if (!prev || end > prev.until) busy[id] = { kind: e.category === 'work' ? 'work' : 'event', title: e.title, until: end };
    }
  }
  for (const u of unavailable) {
    if (!adultIds.includes(u.memberId)) continue;
    const start = parseLocal(u.start);
    const end = u.allDay ? addDays(startOfDay(parseLocal(u.end)), 1) : parseLocal(u.end);
    if (!(start < to && end > from)) continue;
    const prev = busy[u.memberId];
    if (!prev || end > prev.until) busy[u.memberId] = { kind: 'unavailable', title: u.note || 'Unavailable', until: end };
  }
  return busy;
}

export function coverageAvailability(
  window: CoverageWindow,
  events: HouseholdEvent[],
  adultIds: MemberId[],
  viewerId: MemberId,
  unavailable: UnavailablePeriod[] = [],
): { viewerBusy?: Busy; others: MemberId[] } {
  const busy = busyAdults(window, events, adultIds, unavailable);
  return { viewerBusy: busy[viewerId], others: adultIds.filter((id) => id !== viewerId && !busy[id]) };
}

/** Overdue means the mail was missed yesterday as well, not just unchecked today. */
export function mailOverdue(checkedAt: Date, now: Date): boolean {
  return dayDiff(now, checkedAt) >= 2;
}
