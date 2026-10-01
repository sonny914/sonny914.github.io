/**
 * Domain model for the household. Everything the UI reads goes through these
 * types so a database can replace the mock layer without touching components.
 *
 * Time convention: local wall-clock strings, "YYYY-MM-DDTHH:mm" (no zone).
 * One home, one time zone. Revisit before calendar sync.
 */

export type LocalDateTime = string;
export type MemberId = string;

// ---- People ---------------------------------------------------------------

export type MemberRole = 'adult' | 'child';

/** Palette key; the CSS maps each to a restrained colour. */
export type MemberColor = 'blue' | 'berry' | 'teal' | 'ochre' | 'violet';

export interface HouseholdMember {
  id: MemberId;
  /** Display name. Rename here (or via a future profile editor) only. */
  name: string;
  /** One letter shown in the avatar. Must be unique across the household. */
  initial: string;
  role: MemberRole;
  color: MemberColor;
  /** Only adults will ever sign in. */
  hasAccount: boolean;
}

// ---- Events ---------------------------------------------------------------

export type EventCategory =
  | 'work'
  | 'school'
  | 'appointment'
  | 'therapy'
  | 'family'
  | 'childcare'
  | 'household';

/**
 * 'pending' = someone must confirm (RSVP, appointment confirmation, shift swap).
 * 'not_required' = informational.
 */
export type ConfirmationState = 'confirmed' | 'pending' | 'not_required';

export interface Confirmation {
  state: ConfirmationState;
  /** What needs confirming, shown to the household. */
  prompt?: string;
  /** Adult expected to confirm. */
  assignedTo?: MemberId;
}

export interface HouseholdEvent {
  id: string;
  title: string;
  category: EventCategory;
  start: LocalDateTime;
  /** Omitted for all-day events. */
  end?: LocalDateTime;
  allDay?: boolean;
  location?: string;
  notes?: string;
  /** Whose day this is on (children and/or adults). */
  participantIds: MemberId[];
  /** Adults accountable for making it happen. Empty = unassigned. */
  responsibleAdultIds: MemberId[];
  confirmation: Confirmation;
  /** Set when this event is a work shift imported from an uploaded schedule. */
  sourceScheduleId?: string;
}

// ---- Coverage -------------------------------------------------------------

export type CoverageKind = 'pickup' | 'dropoff' | 'care' | 'other';

export interface CoverageRequest {
  id: string;
  title: string;
  kind: CoverageKind;
  start: LocalDateTime;
  end?: LocalDateTime;
  allDay?: boolean;
  /** Child (or children) needing cover. */
  forMemberIds: MemberId[];
  /** Linked event, if the need came from one. */
  eventId?: string;
  status: 'open' | 'claimed';
  claimedBy?: MemberId;
  /** Why this is a gap, in plain words. */
  reason?: string;
}

// ---- Reminders and tasks --------------------------------------------------

export interface RecurrenceRule {
  freq: 'daily' | 'weekly' | 'monthly';
  /** 0 = Sunday. Weekly only. */
  byWeekday?: number[];
}

export interface Reminder {
  id: string;
  title: string;
  /** One-off tasks have a due date; recurring reminders have a rule. */
  dueAt?: LocalDateTime;
  recurrence?: RecurrenceRule;
  assigneeIds: MemberId[];
  completedAt?: LocalDateTime;
  completedBy?: MemberId;
}

/** Last time the physical mailbox was checked. */
export interface MailCheck {
  checkedBy: MemberId;
  checkedAt: LocalDateTime;
}

// ---- Uploaded work schedules (type only in slice 1) ------------------------

export interface UploadedSchedule {
  id: string;
  memberId: MemberId;
  fileName: string;
  uploadedAt: LocalDateTime;
  status: 'needs_review' | 'imported';
}

// ---- Whole-household snapshot --------------------------------------------

export interface HouseholdSnapshot {
  members: HouseholdMember[];
  events: HouseholdEvent[];
  coverageRequests: CoverageRequest[];
  reminders: Reminder[];
  uploadedSchedules: UploadedSchedule[];
  mailCheck: MailCheck;
}
