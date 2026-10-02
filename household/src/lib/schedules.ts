import type { ChildUpdate, ChildUpdateType, EventCategory, HouseholdEvent, WorkEntry } from '../data/types';
import { addDays, parseLocal, startOfDay, toLocal } from './dates';

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const pad = (n: number) => String(n).padStart(2, '0');
export const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDateKey = (k: string): Date => {
  const [y = 0, m = 1, d = 1] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// ---- Work entries -----------------------------------------------------------

export interface ShiftInput {
  date: string;
  start: string;
  end: string;
  repeats: boolean;
  weekdays: number[];
  until: string;
}

/** Returns an error message a person can act on, or null when the shift is valid. */
export function validateShift(i: ShiftInput): string | null {
  if (!i.date) return 'Choose a date.';
  if (!i.start || !i.end) return 'Enter a start and end time.';
  if (i.end <= i.start) return 'End time must be after the start time. Overnight shifts are not supported.';
  if (i.repeats) {
    if (i.weekdays.length === 0) return 'Choose at least one day to repeat on.';
    if (i.until && i.until < i.date) return 'The repeat end date must be on or after the first date.';
  }
  return null;
}

/** All dates a work entry falls on within [from, to], inclusive. */
export function workEntryDates(e: WorkEntry, from: Date, to: Date): string[] {
  const first = parseDateKey(e.date);
  const out: string[] = [];
  if (!e.repeat) {
    if (first >= startOfDay(from) && first <= to) out.push(e.date);
    return out;
  }
  const until = e.repeat.until ? parseDateKey(e.repeat.until) : undefined;
  for (let d = startOfDay(first > from ? first : from); d <= to; d = addDays(d, 1)) {
    if (d < first) continue;
    if (until && d > until) break;
    if (e.repeat.weekdays.includes(d.getDay())) out.push(toDateKey(d));
  }
  return out;
}

/** Ids are derived from the entry id and date, so rebuilding never duplicates. */
export function expandWorkEntry(e: WorkEntry, from: Date, to: Date): HouseholdEvent[] {
  return workEntryDates(e, from, to).map((day) => ({
    id: `w-${e.id}-${day}`,
    title: 'Work shift',
    category: 'work' as const,
    start: `${day}T${e.start}`,
    end: `${day}T${e.end}`,
    participantIds: [e.memberId],
    responsibleAdultIds: [e.memberId],
    confirmation: { state: 'not_required' as const },
    origin: { kind: 'work-entry' as const, id: e.id },
  }));
}

export function describeWorkEntry(e: WorkEntry): string {
  const times = `${fmtHm(e.start)} to ${fmtHm(e.end)}`;
  if (!e.repeat) {
    const d = parseDateKey(e.date);
    return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${times}`;
  }
  const days = [...e.repeat.weekdays].sort().map((n) => WEEKDAYS[n]).join(', ');
  const until = e.repeat.until ? ` until ${parseDateKey(e.repeat.until).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : '';
  return `Every ${days} · ${times}${until}`;
}

export function fmtHm(hm: string): string {
  const [h = 0, m = 0] = hm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ---- Child updates ----------------------------------------------------------

export const UPDATE_TYPES: { id: ChildUpdateType; label: string }[] = [
  { id: 'school', label: 'School' },
  { id: 'appointment', label: 'Appointment' },
  { id: 'therapy', label: 'Therapy' },
  { id: 'reminder', label: 'Reminder' },
  { id: 'note', label: 'General note' },
];

const CATEGORY_FOR: Record<ChildUpdateType, EventCategory> = {
  school: 'school',
  appointment: 'appointment',
  therapy: 'therapy',
  reminder: 'household',
  note: 'family',
};

/**
 * A dated update becomes exactly one shared event, however many children it names.
 * School, appointments and therapy start unassigned (someone has to take them);
 * reminders and notes belong to whoever wrote them.
 */
export function updateToEvent(u: ChildUpdate): HouseholdEvent | undefined {
  if (!u.at) return undefined;
  const start = parseLocal(u.at);
  const mine = u.type === 'reminder' || u.type === 'note';
  return {
    id: `u-${u.id}`,
    title: u.title,
    category: CATEGORY_FOR[u.type],
    start: u.at,
    end: toLocal(new Date(start.getTime() + 30 * 60_000)),
    notes: u.note,
    participantIds: u.childIds,
    responsibleAdultIds: mine ? [u.updatedBy] : [],
    confirmation: { state: 'not_required' },
    origin: { kind: 'child-update', id: u.id },
  };
}

export function updateTypeLabel(t: ChildUpdateType): string {
  return UPDATE_TYPES.find((x) => x.id === t)?.label ?? t;
}
