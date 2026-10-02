import type { Audit, ChildUpdate, HouseholdMember, MemberId, UnavailablePeriod, WorkEntry } from '../data/types';
import type { ChildUpdateInput } from '../components/ChildUpdateForm';
import type { UnavailableInput } from '../components/UnavailableForm';
import { formatWhen, parseLocal, toLocal } from './dates';
import { newId } from './id';
import type { ShiftInput } from './schedules';

/** Creation stamp, or the previous creation stamp with a fresh edit stamp. */
export function stamp(by: MemberId, now: Date, prev?: Audit): Audit {
  const at = toLocal(now);
  return prev
    ? { createdBy: prev.createdBy, createdAt: prev.createdAt, updatedBy: by, updatedAt: at }
    : { createdBy: by, createdAt: at, updatedBy: by, updatedAt: at };
}

export function shiftToEntry(i: ShiftInput, memberId: MemberId, by: MemberId, now: Date, prev?: WorkEntry): WorkEntry {
  return {
    id: prev?.id ?? newId('wk'),
    memberId,
    date: i.date,
    start: i.start,
    endDate: i.endDate,
    end: i.end,
    repeat: i.repeats ? { weekdays: [...i.weekdays].sort(), until: i.until || undefined } : undefined,
    ...stamp(by, now, prev),
  };
}

export function inputToPeriod(i: UnavailableInput, memberId: MemberId, by: MemberId, now: Date, prev?: UnavailablePeriod): UnavailablePeriod {
  return {
    id: prev?.id ?? newId('un'),
    memberId,
    start: i.allDay ? `${i.startDate}T00:00` : `${i.startDate}T${i.startTime}`,
    end: i.allDay ? `${i.endDate}T00:00` : `${i.endDate}T${i.endTime}`,
    allDay: i.allDay,
    note: i.note.trim() || undefined,
    ...stamp(by, now, prev),
  };
}

export function inputToUpdate(i: ChildUpdateInput, by: MemberId, now: Date, prev?: ChildUpdate): ChildUpdate {
  return {
    id: prev?.id ?? newId('cu'),
    childIds: i.childIds,
    type: i.type,
    title: i.title,
    note: i.note || undefined,
    at: i.date && i.time ? `${i.date}T${i.time}` : undefined,
    ...stamp(by, now, prev),
  };
}

/** "Added by Jay, Oct 1" or "Added by Jay · Edited by Fallon, Today, 8:00 AM". */
export function attribution(a: Audit, members: HouseholdMember[], now: Date): string {
  const name = (id: MemberId) => members.find((m) => m.id === id)?.name ?? 'Someone';
  const added = `Added by ${name(a.createdBy)}, ${formatWhen(parseLocal(a.createdAt), now)}`;
  const edited = a.updatedAt !== a.createdAt || a.updatedBy !== a.createdBy;
  return edited ? `${added} · Edited by ${name(a.updatedBy)}, ${formatWhen(parseLocal(a.updatedAt), now)}` : added;
}
