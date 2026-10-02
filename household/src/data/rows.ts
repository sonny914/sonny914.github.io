import type {
  Audit,
  ChildUpdate,
  ChildUpdateType,
  LocalDateTime,
  MailCheck,
  TrustedContact,
  UnavailablePeriod,
  WorkEntry,
} from './types';
import { toLocal } from '../lib/dates';

/** Database rows, shaped like PostgREST returns them, and the pure mapping to and from the app's types. */

interface StampRow {
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
}

export interface WorkRow extends StampRow {
  id: string;
  member_id: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  repeat_weekdays: number[] | null;
  repeat_until: string | null;
}

export interface AwayRow extends StampRow {
  id: string;
  member_id: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  note: string | null;
}

export interface UpdateRow extends StampRow {
  id: string;
  type: ChildUpdateType;
  title: string;
  note: string | null;
  at: string | null;
}

export interface ContactRow {
  id: string;
  name: string;
  role: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

export interface MailRow {
  checked_by: string;
  checked_at: string;
}

/** timestamptz (an instant) -> the household's wall clock, "YYYY-MM-DDTHH:mm". */
export const instantToLocal = (iso: string): LocalDateTime => toLocal(new Date(iso));

/** timestamp WITHOUT time zone (already wall clock) -> "YYYY-MM-DDTHH:mm". */
export const wallToLocal = (ts: string): LocalDateTime => ts.replace(' ', 'T').slice(0, 16);

const hm = (t: string) => t.slice(0, 5);

function audit(r: StampRow): Audit {
  return {
    createdBy: r.created_by,
    createdAt: instantToLocal(r.created_at),
    updatedBy: r.updated_by,
    updatedAt: instantToLocal(r.updated_at),
  };
}

export function workFromRow(r: WorkRow): WorkEntry {
  return {
    id: r.id,
    memberId: r.member_id,
    date: r.start_date,
    start: hm(r.start_time),
    endDate: r.end_date,
    end: hm(r.end_time),
    repeat: r.repeat_weekdays ? { weekdays: r.repeat_weekdays, until: r.repeat_until ?? undefined } : undefined,
    ...audit(r),
  };
}

/** What the browser sends. Attribution is deliberately absent: the database sets it from the account. */
export function workToRow(e: WorkEntry) {
  return {
    id: e.id,
    member_id: e.memberId,
    start_date: e.date,
    start_time: e.start,
    end_date: e.endDate,
    end_time: e.end,
    repeat_weekdays: e.repeat?.weekdays ?? null,
    repeat_until: e.repeat?.until ?? null,
  };
}

export function awayFromRow(r: AwayRow): UnavailablePeriod {
  return {
    id: r.id,
    memberId: r.member_id,
    start: wallToLocal(r.start_at),
    end: wallToLocal(r.end_at),
    allDay: r.all_day,
    note: r.note ?? undefined,
    ...audit(r),
  };
}

export function awayToRow(u: UnavailablePeriod) {
  return {
    id: u.id,
    member_id: u.memberId,
    start_at: u.start,
    end_at: u.end,
    all_day: u.allDay,
    note: u.note ?? null,
  };
}

export function updateFromRow(r: UpdateRow, childIds: string[]): ChildUpdate {
  return {
    id: r.id,
    childIds,
    type: r.type,
    title: r.title,
    note: r.note ?? undefined,
    at: r.at ? wallToLocal(r.at) : undefined,
    ...audit(r),
  };
}

export function updateToRpcArgs(u: ChildUpdate) {
  return {
    p_id: u.id,
    p_type: u.type,
    p_title: u.title,
    p_note: u.note ?? null,
    p_at: u.at ?? null,
    p_child_ids: u.childIds,
  };
}

export function contactFromRow(r: ContactRow): TrustedContact {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    relationship: r.relationship ?? undefined,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    notes: r.notes ?? undefined,
    updatedBy: r.updated_by ?? undefined,
    updatedAt: r.updated_at ? instantToLocal(r.updated_at) : undefined,
  };
}

export function mailFromRow(r: MailRow): MailCheck {
  return { checkedBy: r.checked_by, checkedAt: instantToLocal(r.checked_at) };
}
