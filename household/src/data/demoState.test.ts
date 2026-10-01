import { describe, expect, it } from 'vitest';
import { buildSeed } from './seed';
import { EMPTY_DEMO_STATE, applyDemoState, claimCoverage, completeTask, confirmEvent, releaseCoverage, reopenTask, setMail, unconfirmEvent } from './demoState';
import { attentionItems } from '../lib/schedule';

const now = new Date(2026, 9, 1, 14, 0);
const seed = buildSeed(now);

describe('demo state overlay', () => {
  it('does not change the seed when nothing was done', () => {
    expect(applyDemoState(seed, EMPTY_DEMO_STATE)).toEqual(seed);
  });

  it('claiming coverage removes the item from needs attention and records who', () => {
    const s = claimCoverage(EMPTY_DEMO_STATE, 'cov-pickup-today', 'fallon');
    const next = applyDemoState(seed, s);
    expect(next.coverageRequests.find((c) => c.id === 'cov-pickup-today')).toMatchObject({ status: 'claimed', claimedBy: 'fallon' });
    expect(attentionItems(next, now, 'all').some((i) => i.id === 'cov-pickup-today')).toBe(false);
  });

  it('confirming an event and finishing a task clear their items', () => {
    let s = confirmEvent(EMPTY_DEMO_STATE, 'e-khodi-therapy-confirm');
    s = completeTask(s, 'r-library', 'adult3', '2026-10-01T14:00');
    const ids = attentionItems(applyDemoState(seed, s), now, 'all').map((i) => i.id);
    expect(ids).not.toContain('confirm-e-khodi-therapy-confirm');
    expect(ids).not.toContain('r-library');
  });

  it('sets and clears the mail check without touching other state', () => {
    const checked = setMail(claimCoverage(EMPTY_DEMO_STATE, 'x', 'jay'), { checkedBy: 'jay', checkedAt: '2026-10-01T14:00' });
    expect(applyDemoState(seed, checked).mailCheck.checkedBy).toBe('jay');
    const cleared = setMail(checked, undefined);
    expect(cleared.mail).toBeUndefined();
    expect(cleared.coverage).toEqual({ x: 'jay' });
  });
});

describe('undo', () => {
  it('releases coverage, unconfirms and reopens, restoring the attention items', () => {
    const before = attentionItems(seed, now, 'all').map((i) => i.id).sort();
    let s = claimCoverage(EMPTY_DEMO_STATE, 'cov-pickup-today', 'jay');
    s = confirmEvent(s, 'e-khodi-therapy-confirm');
    s = completeTask(s, 'r-library', 'jay', '2026-10-01T14:00');
    s = releaseCoverage(s, 'cov-pickup-today');
    s = unconfirmEvent(s, 'e-khodi-therapy-confirm');
    s = reopenTask(s, 'r-library');
    expect(attentionItems(applyDemoState(seed, s), now, 'all').map((i) => i.id).sort()).toEqual(before);
  });
});
