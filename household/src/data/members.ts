import type { EventCategory, HouseholdMember } from './types';

export const MEMBERS: HouseholdMember[] = [
  { id: 'jay', name: 'Jay', initial: 'J', role: 'adult', color: 'blue', hasAccount: true },
  { id: 'fallon', name: 'Fallon', initial: 'F', role: 'adult', color: 'berry', hasAccount: true },
  // The id stays 'adult3' so saved demo state keeps working. Only the display name changed.
  { id: 'adult3', name: 'Breeze', initial: 'B', role: 'adult', color: 'teal', hasAccount: true },
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
