// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';

const KEY = 'cottage.demo.v1';
const SESSION = 'cottage.demo.viewingAs.v1';
const stored = () => JSON.parse(window.localStorage.getItem(KEY) ?? '{}');
const nav = () => within(screen.getByRole('navigation', { name: /main/i }));
const click = (name: RegExp | string, scope: ReturnType<typeof within> | typeof screen = screen) => fireEvent.click(scope.getByRole('button', { name }));
const fill = (label: string | RegExp, value: string, scope: ReturnType<typeof within> | typeof screen = screen) =>
  fireEvent.change(scope.getByLabelText(label), { target: { value } });
const allSetUp = { setup: { jay: 'skipped', fallon: 'skipped', adult3: 'skipped' } };

function startAs(id: string, state: object = allSetUp) {
  window.localStorage.setItem(SESSION, id);
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

// Thursday 1 Oct 2026, 2:00 PM.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 1, 14, 0));
  window.localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
  vi.useRealTimers();
});

describe('1. Returning adults bypass setup; switching opens the right profile', () => {
  it('goes straight to Home for each returning adult, and "Update my schedule" opens that adult\'s own profile', () => {
    for (const [id, name] of [['jay', 'Jay'], ['fallon', 'Fallon'], ['adult3', 'Breeze']] as const) {
      window.localStorage.clear();
      startAs(id);
      const { unmount } = render(<App />);
      expect(screen.queryByRole('heading', { name: /who are you|add your work schedule/i })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(name);
      click(/update my schedule/i);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(name);
      expect(screen.queryByText(/only .* can change/i)).not.toBeInTheDocument(); // it is theirs to edit
      unmount();
    }
  });

  it('switching person (Switch person, then choosing someone already set up) lands on that person\'s Home and profile', () => {
    startAs('jay');
    render(<App />);
    click(/household/i, nav());
    expect(screen.getByText(/using the cottage as/i)).toHaveTextContent('Jay');
    click(/switch person/i);
    click('Breeze');
    expect(screen.queryByRole('heading', { name: /add your work schedule/i })).not.toBeInTheDocument(); // already set up
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Breeze');
    click(/update my schedule/i);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Breeze');
  });

  it('switching to someone who has not done setup opens their setup, not the previous person\'s', () => {
    startAs('jay', { setup: { jay: 'skipped' } });
    render(<App />);
    fireEvent.change(screen.getByLabelText(/viewing as/i), { target: { value: 'fallon' } });
    expect(screen.getByRole('heading', { name: /add your work schedule/i })).toBeInTheDocument();
    expect(screen.getByText(/welcome, fallon/i)).toBeInTheDocument();
  });
});

describe('2. Editing a recurring shift updates the series without duplicates', () => {
  it('keeps one record with the same id, and Home shows each occurrence once', () => {
    startAs('adult3');
    render(<App />);
    click(/update my schedule/i);
    click(/^update my schedule$/i);
    let dlg = within(screen.getByRole('dialog'));
    fill('Date', '2026-10-02', dlg);
    fill('Start time', '09:00', dlg);
    fill('End time', '17:00', dlg);
    fireEvent.click(dlg.getByLabelText(/repeats every week/i));
    for (const d of ['Monday', 'Wednesday', 'Friday']) click(d, dlg);
    click(/save shift/i, dlg);
    const idBefore = stored().workEntries[0].id;

    click(/edit shift/i);
    dlg = within(screen.getByRole('dialog'));
    fill('End time', '15:00', dlg);
    click(/save shift/i, dlg);

    expect(stored().workEntries).toHaveLength(1);
    expect(stored().workEntries[0]).toMatchObject({ id: idBefore, end: '15:00' });
    expect(within(screen.getByRole('region', { name: /work schedule/i })).getAllByRole('listitem')).toHaveLength(1);

    click(/home/i, nav());
    const rows = within(screen.getByRole('region', { name: /next 7 days/i }))
      .getAllByRole('heading', { name: 'Work shift' })
      .filter((h) => within(h.closest('li')!).queryByText('Breeze'));
    expect(rows).toHaveLength(3); // Fri 2, Mon 5, Wed 7: once each
    for (const r of rows) expect(r.closest('li')).toHaveTextContent('until 3:00 PM');
  });
});

describe('3. An update for both twins is one shared record', () => {
  it('is stored once with both children and shows in both profiles', () => {
    startAs('jay');
    render(<App />);
    click(/household/i, nav());
    click(/khodi/i);
    click(/add an update/i);
    const dlg = within(screen.getByRole('dialog'));
    fireEvent.click(dlg.getByLabelText('Kenzli'));
    fill('Title', 'School photos', dlg);
    click(/save update/i, dlg);

    expect(stored().childUpdates).toHaveLength(1);
    expect(stored().childUpdates[0].childIds.sort()).toEqual(['kenzli', 'khodi']);
    expect(within(screen.getByRole('region', { name: /updates/i })).getAllByText('School photos', { selector: '.entry__title' })).toHaveLength(1);

    click(/← household/i);
    click(/kenzli/i);
    expect(within(screen.getByRole('region', { name: /updates/i })).getAllByText('School photos', { selector: '.entry__title' })).toHaveLength(1);
    expect(stored().childUpdates).toHaveLength(1);
  });
});

describe('4. Saved entries survive a reload and appear on Home', () => {
  it('keeps shifts, updates and contact details after unmount and a fresh render', () => {
    startAs('jay');
    const first = render(<App />);
    click(/household/i, nav());
    click(/jay/i);
    click(/^update my schedule$/i);
    const dlg = within(screen.getByRole('dialog'));
    fill('Date', '2026-10-02', dlg);
    fill('Start time', '08:00', dlg);
    fill('End time', '16:30', dlg);
    click(/save shift/i, dlg);
    first.unmount();

    render(<App />); // a fresh load of the same browser
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Jay');
    const upcoming = within(screen.getByRole('region', { name: /next 7 days/i }));
    const jay = upcoming.getAllByRole('heading', { name: 'Work shift' }).filter((h) => within(h.closest('li')!).queryByText('Jay'));
    expect(jay).toHaveLength(1);
    expect(jay[0]!.closest('li')).toHaveTextContent('8:00 AM');
    expect(jay[0]!.closest('li')).toHaveTextContent('until 4:30 PM');
  });
});

describe('5. Storage failures show an error instead of "Saved"', () => {
  const failWrites = () =>
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });

  it('a failed shift save shows an error, keeps the form and what was typed, saves nothing, then succeeds when storage works', () => {
    startAs('jay');
    render(<App />);
    click(/household/i, nav());
    click(/jay/i);
    click(/^update my schedule$/i);
    let dlg = within(screen.getByRole('dialog'));
    fill('Date', '2026-10-02', dlg);
    fill('Start time', '08:00', dlg);
    fill('End time', '16:00', dlg);

    const spy = failWrites();
    click(/save shift/i, dlg);
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t save/i);
    expect(screen.queryByText(/saved on this device only/i)).not.toBeInTheDocument();
    dlg = within(screen.getByRole('dialog')); // still open
    expect(dlg.getByLabelText('Date')).toHaveValue('2026-10-02');
    expect(dlg.getByLabelText('End time')).toHaveValue('16:00');
    expect(stored().workEntries ?? []).toHaveLength(0);

    spy.mockRestore();
    click(/save shift/i, dlg);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/shift saved on this device only/i);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(stored().workEntries).toHaveLength(1);
  });

  it('a failed child update, contact save and mail check each report the failure and change nothing', () => {
    startAs('jay');
    render(<App />);

    // mail check
    failWrites();
    click(/mark as checked/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t save/i);
    expect(screen.getByRole('heading', { name: /mail needs to be checked/i })).toBeInTheDocument();
    vi.restoreAllMocks();

    // child update
    click(/household/i, nav());
    click(/kenzli/i);
    click(/add an update/i);
    let dlg = within(screen.getByRole('dialog'));
    fill('Title', 'Library day', dlg);
    failWrites();
    click(/save update/i, dlg);
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t save/i);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(stored().childUpdates ?? []).toHaveLength(0);
    vi.restoreAllMocks();
    click(/cancel/i, within(screen.getByRole('dialog')));

    // contact
    click(/← household/i);
    click(/fran/i);
    click(/add contact details/i);
    dlg = within(screen.getByRole('dialog'));
    fill('Phone', '555-0199', dlg);
    failWrites();
    click(/save details/i, dlg);
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t save/i);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(stored().contacts?.fran?.phone).toBeUndefined();
  });

  it('a failed setup save keeps the onboarding form open', () => {
    render(<App />);
    click('Breeze');
    click(/add my shifts/i);
    fill('Date', '2026-10-02');
    fill('Start time', '09:00');
    fill('End time', '17:00');
    failWrites();
    click(/save shift/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t save/i);
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-02'); // form still there with the data
    expect(screen.queryByLabelText(/shifts you added/i)).not.toBeInTheDocument();
  });
});

describe('6. Fran starts empty and never counts as confirmed coverage', () => {
  it('has no details, and nothing about her changes who is covering', () => {
    startAs('jay');
    render(<App />);
    click(/household/i, nav());
    click(/fran/i);
    expect(screen.getAllByText(/not added yet/i)).toHaveLength(2); // phone and email
    expect(screen.getByText(/is not confirmed childcare/i)).toBeInTheDocument();
    expect(stored().contacts?.fran).toBeUndefined();

    click(/add contact details/i);
    fill('Phone', '555-0142', within(screen.getByRole('dialog')));
    click(/save details/i, within(screen.getByRole('dialog')));
    expect(screen.getByText('555-0142')).toBeInTheDocument();

    // Having her number changes nothing about coverage: the pickup is still open for the household.
    click(/home/i, nav());
    const attention = within(screen.getByRole('region', { name: /needs attention/i }));
    expect(attention.getByRole('button', { name: /Kenzli pickup/i })).toBeInTheDocument();
    expect(attention.getByText(/no one else is free/i)).toBeInTheDocument();
    expect(stored().coverage ?? {}).toEqual({});
  });

  it('a stored claim naming her is ignored (she is not an adult member)', () => {
    startAs('jay', { ...allSetUp, coverage: { 'cov-pickup-today': 'fran' } });
    render(<App />);
    const attention = within(screen.getByRole('region', { name: /needs attention/i }));
    expect(attention.getByRole('button', { name: /Kenzli pickup/i })).toBeInTheDocument();
  });
});
