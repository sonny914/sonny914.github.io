// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent as raw, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { createAccountAuth, type AuthApi } from './auth/accountAuth';
import type { DbError } from './data/db';
import { createSupabaseRepository } from './data/supabaseRepository';
import { createHousehold } from './db/testDb';
import { pgliteDbClient } from './db/pgliteClient';
import { fireEvent } from './testing/events';
import type { Services } from './services';

type H = Awaited<ReturnType<typeof createHousehold>>;
type Who = 'jay' | 'fallon' | 'breeze';
let h: H;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 1, 14, 0)); // Thursday 1 Oct 2026, 2:00 PM
  window.localStorage.clear();
  h = await createHousehold();
}, 60_000);
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const EMAIL: Record<Who, string> = { jay: 'jay@cottage.test', fallon: 'fallon@cottage.test', breeze: 'breeze@cottage.test' };

/**
 * One person's browser: the real account auth and the real repository, talking to the real migrations
 * as that person's database session. Only the e-mail provider is faked: `signedIn` is what GoTrue would
 * report, and identity still comes from the database's account link.
 */
function browser(who: Who | 'stranger', opts: { signedIn?: boolean; failWith?: DbError } = {}): Services & { api: { signedIn: boolean } } {
  const session = who === 'stranger' ? h.as('00000000-0000-0000-0000-00000000dead') : h[who];
  const email = who === 'stranger' ? 'stranger@example.com' : EMAIL[who];
  const api = { signedIn: opts.signedIn ?? true };
  const authApi: AuthApi = {
    getSession: async () => ({ data: { session: api.signedIn ? { user: { email } } : null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithOtp: async () => ({ error: null }),
    verifyOtp: async ({ token }) => {
      if (token !== '123456') return { error: { message: 'bad code' } };
      api.signedIn = true;
      return { error: null };
    },
    signOut: async () => {
      api.signedIn = false;
      return { error: null };
    },
  };
  const client = pgliteDbClient(session, { failWith: opts.failWith });
  return { repo: createSupabaseRepository(client), auth: createAccountAuth(client, authApi), api };
}

type Scope = ReturnType<typeof within>;
const nav = (scope: Scope) => within(scope.getByRole('navigation', { name: /main/i }));
async function mount(who: Who, opts: Parameters<typeof browser>[1] = {}) {
  const services = browser(who, opts);
  const view = render(<App services={services} />);
  return { services, view, ui: within(view.container) };
}
/** A signed-in adult with no schedule yet sees first-time setup; skip it to reach Home. */
async function skipSetup(ui: Scope) {
  await fireEvent.click(await ui.findByRole('button', { name: /skip for now/i }));
  await ui.findByRole('heading', { level: 1 });
}
async function openHousehold(ui: Scope) {
  await fireEvent.click(nav(ui).getByRole('button', { name: /^household$/i }));
}
/** What a returning tab does when it comes to the front. */
const refocus = () => act(async () => void window.dispatchEvent(new Event('focus')));
const count = async (table: string) => Number((await h.admin.query<{ n: string }>(`select count(*) as n from public.${table}`))[0]!.n);

describe('signing in', () => {
  it('shows a sign-in screen with no name picker, and an emailed code signs in as the linked adult', async () => {
    const services = browser('fallon', { signedIn: false });
    const view = render(<App services={services} />);
    const ui = within(view.container);

    expect(await ui.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    for (const name of ['Jay', 'Fallon', 'Breeze']) expect(ui.queryByRole('button', { name })).not.toBeInTheDocument();

    raw.change(ui.getByLabelText(/your e-mail address/i), { target: { value: 'fallon@cottage.test' } });
    await fireEvent.click(ui.getByRole('button', { name: /email me a sign-in link/i }));
    raw.change(await ui.findByLabelText(/code/i), { target: { value: '000000' } });
    await fireEvent.click(ui.getByRole('button', { name: /^sign in$/i }));
    expect(await ui.findByRole('alert')).toHaveTextContent(/code didn’t work/i);
    expect(services.api.signedIn).toBe(false);

    raw.change(ui.getByLabelText(/code/i), { target: { value: '123456' } });
    await fireEvent.click(ui.getByRole('button', { name: /^sign in$/i }));
    await skipSetup(ui);
    expect(ui.getByRole('heading', { level: 1 })).toHaveTextContent('Fallon');
  });

  it('gives a signed-in stranger no access: no household data, no profile, only a way out', async () => {
    const { ui } = await mount('stranger' as Who);
    expect(await ui.findByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(ui.queryByRole('navigation', { name: /main/i })).not.toBeInTheDocument();
    expect(ui.queryByText('Khodi')).not.toBeInTheDocument();
  });

  it('does not let anyone pick another adult: each account is its own adult, whatever is stored in the browser', async () => {
    window.localStorage.setItem('cottage.demo.viewingAs.v1', 'jay'); // a leftover demo choice
    const { ui } = await mount('fallon');
    await skipSetup(ui);
    expect(ui.getByRole('heading', { level: 1 })).toHaveTextContent('Fallon');
    expect(ui.queryByLabelText(/viewing as/i)).not.toBeInTheDocument();
  });
});

describe('two sessions on one household', () => {
  it('Jay saves a shift; Fallon sees it after her next refresh, and the database records Jay’s account', async () => {
    const jay = await mount('jay');
    const fallon = await mount('fallon');
    await skipSetup(jay.ui);
    await skipSetup(fallon.ui);

    await openHousehold(jay.ui);
    await fireEvent.click(jay.ui.getByRole('button', { name: /jay/i }));
    await fireEvent.click(await jay.ui.findByRole('button', { name: /^update my schedule$/i }));
    const dlg = within(screen.getByRole('dialog'));
    raw.change(dlg.getByLabelText('Start date'), { target: { value: '2026-10-02' } });
    raw.change(dlg.getByLabelText('Start time'), { target: { value: '09:00' } });
    raw.change(dlg.getByLabelText('End time'), { target: { value: '17:00' } });
    await fireEvent.click(dlg.getByRole('button', { name: /save shift/i }));
    expect(await jay.ui.findByText(/shift saved\./i)).toBeInTheDocument();

    expect(await count('work_entries')).toBe(1);
    const row = (await h.admin.query<{ member_id: string; created_by: string }>('select member_id, created_by from public.work_entries'))[0]!;
    expect(row).toMatchObject({ member_id: 'jay', created_by: 'jay' });

    // Fallon's tab has not reloaded. Coming back to it does.
    await refocus();
    await openHousehold(fallon.ui);
    await fireEvent.click(fallon.ui.getByRole('button', { name: /jay/i }));
    await waitFor(() => expect(fallon.ui.getByText(/9:00 AM to 5:00 PM/)).toBeInTheDocument());
  });

  it('Fallon can see Jay’s schedule but is offered no way to edit it, and the database refuses a forced attempt', async () => {
    const jay = await mount('jay');
    await skipSetup(jay.ui);
    const entry = { id: 'wk-jay', memberId: 'jay', date: '2026-10-02', start: '09:00', endDate: '2026-10-02', end: '17:00', createdBy: 'jay', createdAt: '', updatedBy: 'jay', updatedAt: '' };
    await jay.services.repo.saveWorkEntry(entry);

    const fallon = await mount('fallon');
    await skipSetup(fallon.ui);
    await openHousehold(fallon.ui);
    await fireEvent.click(fallon.ui.getByRole('button', { name: /jay/i }));
    expect(await fallon.ui.findByText(/9:00 AM to 5:00 PM/)).toBeInTheDocument();
    expect(fallon.ui.queryByRole('button', { name: /edit shift/i })).not.toBeInTheDocument();
    expect(fallon.ui.queryByRole('button', { name: /^update my schedule$/i })).not.toBeInTheDocument();

    // Past the UI: Fallon's own session trying to change Jay's shift changes nothing.
    await expect(fallon.services.repo.saveWorkEntry({ ...entry, start: '01:00', end: '02:00', createdBy: 'fallon', updatedBy: 'fallon' })).rejects.toThrow();
    expect((await h.admin.query<{ start_time: string }>('select start_time from public.work_entries'))[0]!.start_time).toMatch(/^09:00/);
  });

  it('Breeze updates a child; Jay sees it with Breeze named as the author', async () => {
    const jay = await mount('jay');
    const breeze = await mount('breeze');
    await skipSetup(jay.ui);
    await skipSetup(breeze.ui);

    await openHousehold(breeze.ui);
    await fireEvent.click(breeze.ui.getByRole('button', { name: /khodi/i }));
    await fireEvent.click(await breeze.ui.findByRole('button', { name: /add an update/i }));
    const dlg = within(screen.getByRole('dialog'));
    raw.change(dlg.getByLabelText(/title/i), { target: { value: 'Dentist' } });
    await fireEvent.click(dlg.getByRole('button', { name: /save update/i }));
    expect(await breeze.ui.findByText(/update saved\./i)).toBeInTheDocument();

    await refocus();
    await openHousehold(jay.ui);
    await fireEvent.click(jay.ui.getByRole('button', { name: /khodi/i }));
    const item = (await jay.ui.findByText('Dentist')).closest('li')!;
    expect(item).toHaveTextContent('Breeze');
    // Any adult may edit a child's update.
    expect(within(item).getByRole('button', { name: /edit dentist/i })).toBeInTheDocument();
  });
});

describe('a save that fails', () => {
  it('says so, keeps the form open with everything typed, writes nothing, and succeeds on retry', async () => {
    const offline = browser('jay', { failWith: { message: 'TypeError: Failed to fetch' } });
    const online = browser('jay');
    let down = false;
    const flaky: Services = {
      auth: online.auth,
      repo: new Proxy(online.repo, {
        get: (t, p, r) => (p === 'saveChildUpdate' && down ? offline.repo.saveChildUpdate : Reflect.get(t, p, r)),
      }),
    };
    const view = render(<App services={flaky} />);
    const ui = within(view.container);
    await skipSetup(ui);
    await openHousehold(ui);
    await fireEvent.click(ui.getByRole('button', { name: /khodi/i }));
    await fireEvent.click(await ui.findByRole('button', { name: /add an update/i }));

    const dlg = within(screen.getByRole('dialog'));
    raw.change(dlg.getByLabelText(/title/i), { target: { value: 'Speech therapy' } });
    raw.change(dlg.getByLabelText(/note/i), { target: { value: 'Bring the red folder' } });
    down = true;
    await fireEvent.click(dlg.getByRole('button', { name: /save update/i }));

    expect(await screen.findByText(/couldn’t reach the server/i)).toBeInTheDocument();
    expect(screen.queryByText(/update saved/i)).not.toBeInTheDocument();
    expect(dlg.getByLabelText(/title/i)).toHaveValue('Speech therapy');
    expect(dlg.getByLabelText(/note/i)).toHaveValue('Bring the red folder');
    expect(await count('child_updates')).toBe(0);

    down = false;
    await fireEvent.click(dlg.getByRole('button', { name: /save update/i }));
    expect(await ui.findByText(/update saved\./i)).toBeInTheDocument();
    expect(await count('child_updates')).toBe(1);
  });
});

describe('importing records saved on this device', () => {
  const localState = () => ({
    setup: { jay: 'skipped' },
    workEntries: [
      { id: 'wk-local-jay', memberId: 'jay', date: '2026-10-02', start: '09:00', endDate: '2026-10-02', end: '17:00', createdBy: 'jay', createdAt: '2026-09-30T08:00', updatedBy: 'jay', updatedAt: '2026-09-30T08:00' },
      { id: 'wk-local-fallon', memberId: 'fallon', date: '2026-10-03', start: '10:00', endDate: '2026-10-03', end: '14:00', createdBy: 'fallon', createdAt: '2026-09-30T08:00', updatedBy: 'fallon', updatedAt: '2026-09-30T08:00' },
    ],
  });

  it('uploads nothing on its own, offers a review with nothing selected, imports only what is chosen and only your own', async () => {
    window.localStorage.setItem('cottage.demo.v1', JSON.stringify(localState()));
    const { ui } = await mount('jay');

    expect(await ui.findByRole('heading', { name: /review records on this device/i })).toBeInTheDocument();
    expect(await count('work_entries')).toBe(0); // signing in alone uploaded nothing
    for (const box of ui.getAllByRole('checkbox')) expect(box).not.toBeChecked();
    expect(ui.getByRole('button', { name: /import selected \(0\)/i })).toBeDisabled();

    const boxes = ui.getAllByRole('checkbox');
    expect(boxes.filter((b) => (b as HTMLInputElement).disabled)).toHaveLength(1); // Fallon's, which Jay cannot import
    const mine = boxes.find((b) => !(b as HTMLInputElement).disabled)!;

    await fireEvent.click(mine);
    await fireEvent.click(ui.getByRole('button', { name: /import selected \(1\)/i }));
    expect(await ui.findByText(/^imported\.$/i)).toBeInTheDocument();

    const rows = await h.admin.query<{ id: string; created_by: string }>('select id, created_by from public.work_entries');
    expect(rows).toEqual([{ id: 'wk-local-jay', created_by: 'jay' }]);
    // The local copies stay until a person confirms removing them.
    expect(JSON.parse(window.localStorage.getItem('cottage.demo.v1')!).workEntries).toHaveLength(2);
  });

  it('is skippable, and Not now uploads nothing', async () => {
    window.localStorage.setItem('cottage.demo.v1', JSON.stringify(localState()));
    const { ui } = await mount('jay');
    await fireEvent.click(await ui.findByRole('button', { name: /not now/i }));
    await ui.findByRole('heading', { level: 1 });
    expect(await count('work_entries')).toBe(0);
    expect(JSON.parse(window.localStorage.getItem('cottage.demo.v1')!).workEntries).toHaveLength(2);
  });
});
