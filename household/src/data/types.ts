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
  /**
   * Set when the event is derived from another record (a manual work entry or a
   * child update). The event is rebuilt from that record on every read, so
   * editing the record can never leave a second copy behind.
   */
  origin?: { kind: 'work-entry' | 'child-update'; id: string };
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

// ---- Who created / last edited what -----------------------------------------

export interface Audit {
  createdBy: MemberId;
  createdAt: LocalDateTime;
  updatedBy: MemberId;
  updatedAt: LocalDateTime;
}

// ---- Manual work schedule ---------------------------------------------------

/**
 * One shift, or a weekly pattern of shifts. A shift may cross midnight: the end date is explicit
 * (endDate may be the next day). For a weekly pattern, endDate - date is how many days each
 * occurrence runs over.
 */
export interface WorkEntry extends Audit {
  id: string;
  memberId: MemberId;
  /** First (or only) date, "YYYY-MM-DD". */
  date: string;
  /** "HH:mm" */
  start: string;
  /** Last date of the first (or only) shift, "YYYY-MM-DD". */
  endDate: string;
  end: string;
  /** Repeats every week on these weekdays (0 = Sunday), optionally until a date. */
  repeat?: { weekdays: number[]; until?: string };
}

export interface UnavailablePeriod extends Audit {
  id: string;
  memberId: MemberId;
  start: LocalDateTime;
  end: LocalDateTime;
  allDay: boolean;
  note?: string;
}

// ---- Child updates ----------------------------------------------------------

export type ChildUpdateType = 'school' | 'appointment' | 'therapy' | 'reminder' | 'note';

/** One update can be about several children (both twins) and is stored once. */
export interface ChildUpdate extends Audit {
  id: string;
  childIds: MemberId[];
  type: ChildUpdateType;
  title: string;
  note?: string;
  /** When set, the update also appears on the shared calendar as one derived event. */
  at?: LocalDateTime;
}

// ---- Trusted contacts -------------------------------------------------------

/**
 * Someone the household may call. Not a household member: no account, never an
 * assignee, and contacting them is never the same as confirmed childcare.
 */
export interface TrustedContact {
  id: string;
  name: string;
  role: string;
  relationship?: string;
  phone?: string;
  email?: string;
  notes?: string;
  updatedBy?: MemberId;
  updatedAt?: LocalDateTime;
}

export type SetupStatus = 'done' | 'skipped';

/** Month is 1-12. No year is kept. */
export interface MemberBirthday {
  memberId: MemberId;
  month: number;
  day: number;
}

// ---- Whole-household snapshot --------------------------------------------

export interface HouseholdSnapshot {
  members: HouseholdMember[];
  events: HouseholdEvent[];
  coverageRequests: CoverageRequest[];
  reminders: Reminder[];
  uploadedSchedules: UploadedSchedule[];
  /** null until somebody has logged a check (shared mode starts empty). */
  mailCheck: MailCheck | null;
  workEntries: WorkEntry[];
  unavailable: UnavailablePeriod[];
  childUpdates: ChildUpdate[];
  trustedContacts: TrustedContact[];
  /** Per adult: has the schedule step of first-time setup been finished or skipped? */
  setup: Record<MemberId, SetupStatus>;
  /** Everyone whose birthday is known: the household's starting list plus what adults entered. */
  birthdays: MemberBirthday[];
}
