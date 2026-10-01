import type { EventCategory, HouseholdMember } from './types';

/** Placeholder until the third adult's name is supplied. Change it here. */
export const ADULT_3_NAME = 'Adult 3';

export const MEMBERS: HouseholdMember[] = [
  { id: 'jay', name: 'Jay', initial: 'J', role: 'adult', color: 'blue', hasAccount: true },
  { id: 'fallon', name: 'Fallon', initial: 'F', role: 'adult', color: 'berry', hasAccount: true },
  { id: 'adult3', name: ADULT_3_NAME, initial: 'A', role: 'adult', color: 'teal', hasAccount: true },
  { id: 'khodi', name: 'Khodi', initial: 'K', role: 'child', color: 'ochre', hasAccount: false },
  // Kenzli goes by Ducki, hence "D" (and it keeps her apart from Khodi's "K").
  { id: 'kenzli', name: 'Kenzli', initial: 'D', role: 'child', color: 'violet', hasAccount: false },
];

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  work: 'Work',
  school: 'School',
  appointment: 'Appointment',
  therapy: 'Therapy',
  family: 'Family',
  childcare: 'Childcare',
  household: 'Household',
};

export const CATEGORY_ORDER: EventCategory[] = [
  'work',
  'school',
  'appointment',
  'therapy',
  'family',
  'childcare',
  'household',
];
