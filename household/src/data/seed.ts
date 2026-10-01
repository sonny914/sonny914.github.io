import { at } from '../lib/dates';
import type { HouseholdSnapshot } from './types';
import { MEMBERS } from './members';

/**
 * Sample household, generated relative to `today` so the demo never goes stale.
 * Nobody works overnight: shifts are daytime or early evening.
 * Replace this module (via the repository) when a database arrives.
 */
export function buildSeed(today: Date): HouseholdSnapshot {
  const d = (n: number, hh: number, mm = 0) => at(today, n, hh, mm);

  return {
    members: MEMBERS,

    events: [
      // ---- Today ----
      {
        id: 'e-jay-shift-0', title: 'Jay · work shift', category: 'work',
        start: d(0, 8), end: d(0, 16, 30),
        participantIds: ['jay'], responsibleAdultIds: ['jay'],
        confirmation: { state: 'not_required' }, sourceScheduleId: 'sch-jay-1',
      },
      {
        id: 'e-khodi-dropoff-0', title: 'Drop Khodi at school', category: 'school',
        start: d(0, 7, 40), end: d(0, 8, 5), location: 'Maple Elementary',
        participantIds: ['khodi'], responsibleAdultIds: ['fallon'],
        confirmation: { state: 'not_required' },
      },
      {
        id: 'e-kenzli-care-0', title: 'Kenzli at daycare', category: 'childcare',
        start: d(0, 8, 30), end: d(0, 15, 30), location: 'Little Sprouts',
        participantIds: ['kenzli'], responsibleAdultIds: ['adult3'],
        confirmation: { state: 'confirmed' },
      },
      {
        id: 'e-fallon-shift-0', title: 'Fallon · work shift', category: 'work',
        start: d(0, 11), end: d(0, 19),
        participantIds: ['fallon'], responsibleAdultIds: ['fallon'],
        confirmation: { state: 'not_required' }, sourceScheduleId: 'sch-fallon-1',
      },
      {
        id: 'e-khodi-pickup-0', title: 'Pick up Khodi from school', category: 'school',
        start: d(0, 15, 15), end: d(0, 15, 40), location: 'Maple Elementary',
        participantIds: ['khodi'], responsibleAdultIds: ['adult3'],
        confirmation: { state: 'confirmed' },
      },
      {
        id: 'e-kenzli-pickup-0', title: 'Pick up Kenzli from daycare', category: 'childcare',
        start: d(0, 15, 30), end: d(0, 15, 55), location: 'Little Sprouts',
        participantIds: ['kenzli'], responsibleAdultIds: [],
        confirmation: { state: 'not_required' },
      },
      {
        id: 'e-khodi-therapy-0', title: 'Speech therapy', category: 'therapy',
        start: d(0, 16, 30), end: d(0, 17, 15), location: 'Bright Steps Clinic',
        participantIds: ['khodi'], responsibleAdultIds: ['adult3'],
        confirmation: { state: 'confirmed' },
      },
      {
        id: 'e-trash-0', title: 'Trash and recycling to the curb', category: 'household',
        start: d(0, 18), end: d(0, 18, 15),
        participantIds: [], responsibleAdultIds: ['jay'],
        confirmation: { state: 'not_required' },
      },
      {
        id: 'e-dinner-0', title: 'Family dinner', category: 'family',
        start: d(0, 18, 30), end: d(0, 19, 15),
        participantIds: ['jay', 'adult3', 'khodi', 'kenzli'], responsibleAdultIds: ['adult3'],
        confirmation: { state: 'not_required' },
      },

      // ---- Next seven days ----
      {
        id: 'e-picture-day', title: 'Picture day', category: 'school',
        start: d(1, 0), allDay: true, location: 'Maple Elementary',
        notes: 'Send the blue shirt.',
        participantIds: ['khodi'], responsibleAdultIds: ['fallon'],
        confirmation: { state: 'not_required' },
      },
      {
        id: 'e-jay-shift-1', title: 'Jay · work shift', category: 'work',
        start: d(1, 8), end: d(1, 16, 30),
        participantIds: ['jay'], responsibleAdultIds: ['jay'],
        confirmation: { state: 'not_required' }, sourceScheduleId: 'sch-jay-1',
      },
      {
        id: 'e-fallon-shift-1', title: 'Fallon · work shift', category: 'work',
        start: d(1, 7), end: d(1, 15),
        participantIds: ['fallon'], responsibleAdultIds: ['fallon'],
        confirmation: { state: 'not_required' }, sourceScheduleId: 'sch-fallon-1',
      },
      {
        id: 'e-khodi-therapy-confirm', title: 'Occupational therapy', category: 'therapy',
        start: d(1, 16), end: d(1, 16, 45), location: 'Bright Steps Clinic',
        participantIds: ['khodi'], responsibleAdultIds: ['jay'],
        confirmation: {
          state: 'pending',
          prompt: 'Clinic asked us to confirm tomorrow’s time',
          assignedTo: 'jay',
        },
      },
      {
        id: 'e-birthday', title: 'Birthday party: Maya’s', category: 'family',
        start: d(2, 14), end: d(2, 16), location: 'Jump Zone',
        participantIds: ['khodi', 'kenzli'], responsibleAdultIds: ['jay', 'adult3'],
        confirmation: {
          state: 'pending',
          prompt: 'RSVP is due tomorrow',
          assignedTo: 'adult3',
        },
      },
      {
        id: 'e-mealprep', title: 'Meal prep for the week', category: 'household',
        start: d(3, 16), end: d(3, 17, 30),
        participantIds: [], responsibleAdultIds: ['fallon'],
        confirmation: { state: 'not_required' },
      },
      {
        id: 'e-kenzli-checkup', title: 'Kenzli · pediatrician check-up', category: 'appointment',
        start: d(4, 9, 15), end: d(4, 10), location: 'Oak Street Pediatrics',
        participantIds: ['kenzli'], responsibleAdultIds: ['fallon'],
        confirmation: { state: 'confirmed' },
      },
      {
        id: 'e-conference', title: 'Parent-teacher conference', category: 'school',
        start: d(5, 17, 30), end: d(5, 18), location: 'Maple Elementary, room 12',
        participantIds: ['khodi'], responsibleAdultIds: ['jay', 'adult3'],
        confirmation: { state: 'confirmed' },
      },
      {
        id: 'e-fallon-shift-6', title: 'Fallon · work shift', category: 'work',
        start: d(6, 10), end: d(6, 18),
        participantIds: ['fallon'], responsibleAdultIds: ['fallon'],
        confirmation: { state: 'not_required' }, sourceScheduleId: 'sch-fallon-1',
      },
      {
        id: 'e-inservice', title: 'Daycare closed: teacher in-service', category: 'childcare',
        start: d(7, 0), allDay: true, location: 'Little Sprouts',
        participantIds: ['kenzli'], responsibleAdultIds: [],
        confirmation: { state: 'not_required' },
      },
    ],

    coverageRequests: [
      {
        id: 'cov-pickup-today', title: 'Kenzli pickup at 3:30 PM', kind: 'pickup',
        start: d(0, 15, 30), end: d(0, 15, 55), forMemberIds: ['kenzli'],
        eventId: 'e-kenzli-pickup-0', status: 'open',
        reason: 'Adult 3 is picking up Khodi at 3:15. Jay is at work until 4:30.',
      },
      {
        id: 'cov-inservice', title: 'Kenzli needs care all day', kind: 'care',
        start: d(7, 0), allDay: true, forMemberIds: ['kenzli'],
        eventId: 'e-inservice', status: 'open',
        reason: 'Daycare is closed. Fallon works 10 to 6.',
      },
    ],

    reminders: [
      {
        id: 'r-mail', title: 'Check the mail',
        recurrence: { freq: 'daily' }, assigneeIds: ['jay', 'fallon', 'adult3'],
      },
      {
        id: 'r-library', title: 'Return library books', dueAt: d(-1, 17),
        assigneeIds: ['adult3'],
      },
      {
        id: 'r-form', title: 'Sign Khodi’s field trip form', dueAt: d(-2, 20),
        assigneeIds: ['jay'],
      },
      {
        id: 'r-registration', title: 'Renew car registration', dueAt: d(5, 17),
        assigneeIds: ['fallon'],
      },
    ],

    // Slice 1 has no upload flow; the shifts above reference these.
    uploadedSchedules: [
      { id: 'sch-jay-1', memberId: 'jay', fileName: 'jay-october-schedule.pdf', uploadedAt: d(-6, 19), status: 'imported' },
      { id: 'sch-fallon-1', memberId: 'fallon', fileName: 'fallon-october-schedule.pdf', uploadedAt: d(-6, 20), status: 'imported' },
    ],

    mailCheck: { checkedBy: 'fallon', checkedAt: d(-1, 17, 40) },
  };
}
