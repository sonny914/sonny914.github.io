import { describe, expect, it } from 'vitest';
import { EMPTY_DEMO_STATE } from '../data/demoState';
import { buildEmptyHousehold } from '../data/seed';
import type { WorkEntry } from '../data/types';
import { buildImportPlan, hasLocalRecords } from './plan';

const stamp = { createdBy: 'x', createdAt: '', updatedBy: 'x', updatedAt: '' };
const shift = (id: string, memberId: string): WorkEntry => ({ id, memberId, date: '2026-10-02', start: '09:00', endDate: '2026-10-02', end: '17:00', ...stamp });
const shared = () => buildEmptyHousehold();

describe('import plan', () => {
  it('has nothing to review in an untouched browser', () => {
    expect(hasLocalRecords(EMPTY_DEMO_STATE)).toBe(false);
    expect(buildImportPlan(EMPTY_DEMO_STATE, 'jay', shared())).toEqual([]);
  });
  it('only lets you import your own schedule, and says whose the rest is', () => {
    const items = buildImportPlan({ ...EMPTY_DEMO_STATE, workEntries: [shift('a', 'jay'), shift('b', 'fallon')] }, 'jay', shared());
    expect(items.map((i) => !!i.blocked)).toEqual([false, true]);
    expect(items[1]!.blocked).toMatch(/Fallon/);
  });
  it('marks records already in the household, so a second import is a no-op', () => {
    const s = { ...shared(), workEntries: [shift('a', 'jay')] };
    const items = buildImportPlan({ ...EMPTY_DEMO_STATE, workEntries: [shift('a', 'jay')] }, 'jay', s);
    expect(items[0]!.blocked).toMatch(/already/i);
  });
  it('fills only empty details for Fran and never overwrites', () => {
    const s = shared();
    s.trustedContacts = [{ id: 'fran', name: 'Fran', role: 'Preferred backup nanny', relationship: 'Their only nanny since birth', phone: '555-0100' } as never];
    const items = buildImportPlan({ ...EMPTY_DEMO_STATE, contacts: { fran: { phone: '555-9999', email: 'fran@example.com' } } }, 'jay', s);
    expect(items[0]!.record).toMatchObject({ kind: 'contact', patch: { phone: undefined, email: 'fran@example.com' } });
  });
});
