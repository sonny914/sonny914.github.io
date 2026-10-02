import { describe, expect, it } from 'vitest';
import { DEFAULT_BIRTHDAYS, birthdayEvents as events, mergeBirthdays, pickupReminder, pickupReminderText } from './routines';

const birthdayEvents = (now: Date, days: number, nameOf: (id: string) => string, list = DEFAULT_BIRTHDAYS) => events(now, days, nameOf, list);

// October 2026: Mon 5, Tue 6, Thu 8, Fri 9, Sat 10
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);
const text = (d: Date) => {
  const r = pickupReminder(d);
  return r && { ...pickupReminderText(r), items: r.items };
};

describe('pickup reminders', () => {
  it('Monday evening: trash goes out for Tuesday', () => {
    expect(text(at(5, 18))).toMatchObject({ title: 'Tonight: put out the trash', items: ['trash'] });
  });
  it('Thursday evening: trash and recycling for Friday', () => {
    expect(text(at(8, 17))).toMatchObject({ title: 'Tonight: put out the trash and recycling', detail: 'Pickup is tomorrow, Friday.' });
  });
  it('is quiet before 5 PM the day before, and on days with no pickup tomorrow', () => {
    expect(pickupReminder(at(8, 16, 59))).toBeNull();
    expect(pickupReminder(at(6, 20))).toBeNull(); // Tuesday night, Wednesday has none
    expect(pickupReminder(at(9, 20))).toBeNull(); // Friday night, Saturday has none
    expect(pickupReminder(at(7, 20))).toBeNull(); // Wednesday night, Thursday has none
  });
  it('after midnight on pickup day it says today, until 10 AM', () => {
    expect(text(at(9, 7))).toMatchObject({ title: 'Today: trash and recycling pickup' });
    expect(pickupReminder(at(9, 10))).toBeNull();
    expect(pickupReminder(at(10, 7))).toBeNull(); // Saturday morning, nothing today
  });
  it('Tuesday has trash only, so recycling is never prompted for it', () => {
    expect(pickupReminder(at(6, 8))!.items).toEqual(['trash']);
  });
});

describe('birthdays', () => {
  const name = (id: string) => ({ jay: 'Jay', fallon: 'Fallon' })[id] ?? id;
  it('appear as all-day events for the right person, only within the window', () => {
    const e = birthdayEvents(new Date(2027, 2, 20), 8, name);
    expect(e.map((x) => [x.title, x.start.slice(0, 10)])).toEqual([['Jay’s birthday', '2027-03-27']]);
    expect(e[0]).toMatchObject({ allDay: true, participantIds: ['jay'] });
    expect(birthdayEvents(new Date(2027, 2, 10), 8, name).map((x) => x.title)).toEqual(['Fallon’s birthday']);
    expect(birthdayEvents(new Date(2026, 9, 1), 8, name)).toEqual([]);
    const twins = birthdayEvents(new Date(2027, 4, 10), 8, (id) => ({ khodi: 'Khodi', kenzli: 'Kenzli' })[id] ?? id);
    expect(twins).toHaveLength(1);
    expect(twins[0]).toMatchObject({ title: 'Khodi and Kenzli’s birthday', participantIds: ['khodi', 'kenzli'] });
  });

  it('a stored birthday adds a person, replaces a built-in one, and Feb 29 falls on Feb 28 in other years', () => {
    const list = mergeBirthdays(DEFAULT_BIRTHDAYS, [{ memberId: 'adult3', month: 8, day: 2 }, { memberId: 'jay', month: 4, day: 1 }]);
    expect(birthdayEvents(new Date(2027, 7, 1), 3, (id) => (id === 'adult3' ? 'Breeze' : id), list).map((e) => e.title)).toEqual(['Breeze’s birthday']);
    expect(birthdayEvents(new Date(2027, 2, 25), 5, (id) => id, list)).toEqual([]); // Jay moved off 3/27
    const leap = [{ memberId: 'x', month: 2, day: 29 }];
    expect(birthdayEvents(new Date(2027, 1, 27), 2, (id) => id, leap).map((e) => e.start.slice(0, 10))).toEqual(['2027-02-28']);
    expect(birthdayEvents(new Date(2028, 1, 27), 2, (id) => id, leap).map((e) => e.start.slice(0, 10))).toEqual(['2028-02-29']);
  });
});
