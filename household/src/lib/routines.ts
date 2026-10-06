import type { HouseholdEvent, MemberBirthday } from '../data/types';
import { addDays, startOfDay, toLocal } from './dates';

/**
 * Things that repeat on a fixed calendar and need no one to enter them. They are rules, not records, so
 * they behave the same in the demo and in the shared household, and nothing here is ever saved.
 */
export interface PickupRule {
  id: string;
  label: string;
  /** 0 = Sunday. */
  weekdays: number[];
}

export const PICKUPS: PickupRule[] = [
  { id: 'trash', label: 'trash', weekdays: [2, 5] }, // Tuesday and Friday
  { id: 'recycling', label: 'recycling', weekdays: [5] }, // Friday
];

/** Month is 1-12. The birthdays the household has already told us. Anyone else is asked during setup. */
export const DEFAULT_BIRTHDAYS: MemberBirthday[] = [
  { memberId: 'jay', month: 3, day: 27 },
  { memberId: 'fallon', month: 3, day: 14 },
  { memberId: 'khodi', month: 5, day: 15 },
  { memberId: 'kenzli', month: 5, day: 15 },
];

/** The reminder appears from this hour the evening before, and stays until it is the pickup morning's cut-off. */
export const REMINDER_FROM_HOUR = 17;
export const REMINDER_UNTIL_HOUR = 10;

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface PickupReminder {
  /** 'tonight' from the evening before until midnight; 'this-morning' after midnight on pickup day. */
  when: 'tonight' | 'this-morning';
  items: string[];
  /** The pickup day, e.g. "Friday". */
  pickupDay: string;
}

const joinList = (xs: string[]) => (xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** What to put out, if the reminder window is open at `now`. */
export function pickupReminder(now: Date): PickupReminder | null {
  const hour = now.getHours();
  const day = hour >= REMINDER_FROM_HOUR ? addDays(startOfDay(now), 1) : hour < REMINDER_UNTIL_HOUR ? startOfDay(now) : null;
  if (!day) return null;
  const due = PICKUPS.filter((p) => p.weekdays.includes(day.getDay())).map((p) => p.label);
  if (!due.length) return null;
  return { when: hour >= REMINDER_FROM_HOUR ? 'tonight' : 'this-morning', items: due, pickupDay: WEEKDAY[day.getDay()]! };
}

export function pickupReminderText(r: PickupReminder): { title: string; detail: string } {
  const what = joinList(r.items);
  return r.when === 'tonight'
    ? { title: `Tonight: put out the ${what}`, detail: `Pickup is tomorrow, ${r.pickupDay}.` }
    : { title: `Today: ${what} pickup`, detail: 'Put it out this morning if it did not go out last night.' };
}

/** Feb 29 birthdays are kept on Feb 28 in years without one. */
function celebratedOn(b: MemberBirthday, d: Date): boolean {
  if (d.getMonth() + 1 !== b.month) return false;
  if (b.month === 2 && b.day === 29 && new Date(d.getFullYear(), 1, 29).getMonth() !== 1) return d.getDate() === 28;
  return d.getDate() === b.day;
}

/** Stored birthdays win over the built-in ones for the same person. */
export function mergeBirthdays(defaults: MemberBirthday[], stored: MemberBirthday[]): MemberBirthday[] {
  const byMember = new Map([...defaults, ...stored].map((b) => [b.memberId, b]));
  return [...byMember.values()];
}

/** Birthdays within `days` days of today (inclusive), as all-day events. */
export function birthdayEvents(now: Date, days: number, nameOf: (id: string) => string, birthdays: MemberBirthday[]): HouseholdEvent[] {
  const today = startOfDay(now);
  const out: HouseholdEvent[] = [];
  for (let i = 0; i <= days; i++) {
    const d = addDays(today, i);
    // The twins share a day, so they get one event, not two.
    const matches = birthdays.filter((b) => celebratedOn(b, d));
    if (!matches.length) continue;
    const names = matches.map((b) => nameOf(b.memberId));
    out.push({
      id: `birthday-${matches.map((b) => b.memberId).join('-')}-${d.getFullYear()}`,
      title: names.length === 1 ? `${names[0]}’s birthday` : `${names.join(' and ')}’s birthday`,
      category: 'family',
      start: toLocal(d),
      allDay: true,
      participantIds: matches.map((b) => b.memberId),
      responsibleAdultIds: [],
      confirmation: { state: 'not_required' },
    });
  }
  return out;
}
