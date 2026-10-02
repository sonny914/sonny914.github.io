// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { fireEvent } from './testing/events';
import App from './App';

// Thursday 1 Oct 2026, 2:00 PM.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 1, 14, 0));
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const click = async (name: RegExp | string, scope: ReturnType<typeof within> | typeof screen = screen) => fireEvent.click(scope.getByRole('button', { name }));
const type = async (label: RegExp | string, value: string, scope: ReturnType<typeof within> | typeof screen = screen) =>
  fireEvent.change(scope.getByLabelText(label), { target: { value } });

async function chooseAndSkip(name: string) {
  await click(name);
  await click(/skip for now/i);
}
async function openHousehold() {
  await click(/^household$/i, within(screen.getByRole('navigation', { name: /main/i })));
}

describe('First-time adult setup', () => {
  it('asks "Who are you?" with the three adults and says plainly that it is not a sign-in', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /who are you\?/i })).toBeInTheDocument();
    for (const n of ['Jay', 'Fallon', 'Breeze']) expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /khodi|kenzli|fran/i })).not.toBeInTheDocument();
    expect(screen.getByText(/not a\s+sign-in/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it('then asks for a work schedule, offers manual entry and skip, and has no fake upload button', async () => {
    render(<App />);
    await click('Breeze');
    expect(screen.getByRole('heading', { name: /add your work schedule/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add my shifts/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upload|photo|pdf|scan/i })).not.toBeInTheDocument();
    expect(screen.getByText(/come in the next update/i)).toBeInTheDocument();
  });

  it('skipping goes to Home, and a returning adult goes straight to Home', async () => {
    const first = render(<App />);
    await chooseAndSkip('Breeze');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Breeze');
    first.unmount();
    render(<App />);
    expect(screen.queryByRole('heading', { name: /who are you/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /add your work schedule/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Breeze');
  });

  it('can switch person from Household, which returns to "Who are you?"', async () => {
    render(<App />);
    await chooseAndSkip('Jay');
    await openHousehold();
    expect(screen.getByText(/demo mode: this is a name saved in this browser, not a sign-in/i)).toBeInTheDocument();
    await click(/switch person/i);
    expect(screen.getByRole('heading', { name: /who are you\?/i })).toBeInTheDocument();
    await click('Fallon');
    expect(screen.getByRole('heading', { name: /add your work schedule/i })).toBeInTheDocument();
  });
});

describe('Manual work schedule', () => {
  it('validates, saves through onboarding, and Home reflects the shift', async () => {
    render(<App />);
    await click('Breeze');
    await click(/add my shifts/i);
    await type('Start date', '2026-10-02');
    await type('Start time', '17:00');
    await type('End time', '09:00');
    await click(/save shift/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/overnight/i);
    await type('Start time', '09:00');
    await type('End time', '17:00');
    await click(/save shift/i);
    expect(screen.getByLabelText(/shifts you added/i)).toHaveTextContent('Fri, Oct 2 · 9:00 AM to 5:00 PM');
    await click(/^done$/i);

    const upcoming = screen.getByRole('region', { name: /next 7 days/i });
    const mine = within(upcoming).getAllByRole('heading', { name: 'Work shift' }).filter((h) => within(h.closest('li')!).queryByText('Breeze'));
    expect(mine).toHaveLength(1);
    expect(within(mine[0]!.closest('li')!).getByText('9:00 AM')).toBeInTheDocument();
  });

  it('supports weekly repeats, editing without duplicates, and persists across a reload', async () => {
    const first = render(<App />);
    await chooseAndSkip('Breeze');
    await click(/update my schedule/i);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Breeze');
    await click(/^update my schedule$/i);
    const dlg = within(screen.getByRole('dialog'));
    await type('Start date', '2026-10-02', dlg);
    await type('Start time', '09:00', dlg);
    await type('End time', '17:00', dlg);
    await fireEvent.click(dlg.getByLabelText(/repeats every week/i));
    for (const d of ['Monday', 'Wednesday', 'Friday']) await click(d, dlg);
    await click(/save shift/i, dlg);
    expect(screen.getByText('Every Mon, Wed, Fri · 9:00 AM to 5:00 PM')).toBeInTheDocument();

    const breezeRows = async () => {
      await click(/home/i, within(screen.getByRole('navigation', { name: /main/i })));
      const upcoming = screen.getByRole('region', { name: /next 7 days/i });
      return within(upcoming).getAllByRole('heading', { name: 'Work shift' }).filter((h) => within(h.closest('li')!).queryByText('Breeze'));
    };
    expect(await breezeRows()).toHaveLength(3); // Fri 2, Mon 5, Wed 7

    await openHousehold();
    await click(/breeze/i);
    await click(/edit shift/i);
    await type('End time', '15:00', within(screen.getByRole('dialog')));
    await click(/save shift/i, within(screen.getByRole('dialog')));
    expect(await breezeRows()).toHaveLength(3); // edited, not duplicated
    expect(screen.getAllByText(/until 3:00 PM/).length).toBeGreaterThan(0);

    first.unmount();
    render(<App />); // persistence: same device, fresh load
    expect(await breezeRows()).toHaveLength(3);
  });

  it('only the owner can edit a schedule', async () => {
    render(<App />);
    await chooseAndSkip('Jay');
    await openHousehold();
    await click(/fallon/i);
    expect(screen.getByText(/only fallon can change fallon’s schedule/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /update my schedule|add a shift/i })).not.toBeInTheDocument();
  });
});

describe('Child updates', () => {
  async function addTwinUpdate() {
    await openHousehold();
    await click(/khodi/i);
    await click(/add an update/i);
    const dlg = within(screen.getByRole('dialog'));
    await fireEvent.click(dlg.getByLabelText('Kenzli')); // Khodi is preselected; add the other twin
    await fireEvent.change(dlg.getByLabelText('Type'), { target: { value: 'appointment' } });
    await type('Title', 'Dentist', dlg);
    await type('Note (optional)', 'Bring the insurance card', dlg);
    await type('Date (optional)', '2026-10-06', dlg);
    await type('Time', '09:00', dlg);
    await click(/save update/i, dlg);
  }
  const dentistRows = async () => {
    await click(/home/i, within(screen.getByRole('navigation', { name: /main/i })));
    return within(screen.getByRole('region', { name: /next 7 days/i })).queryAllByRole('heading', { name: /dentist/i });
  };

  it('one shared update for both twins appears on both profiles and once on Home, with attribution', async () => {
    render(<App />);
    await chooseAndSkip('Jay');
    await addTwinUpdate();
    const list = screen.getByRole('region', { name: /updates/i });
    expect(within(list).getByText('Dentist', { selector: '.entry__title' })).toBeInTheDocument();
    expect(within(list).getByText(/for khodi and kenzli/i)).toBeInTheDocument();
    expect(within(list).getByText(/bring the insurance card/i)).toBeInTheDocument();
    expect(within(list).getByText(/added by jay/i)).toBeInTheDocument();

    await click(/← household/i);
    await click(/kenzli/i);
    expect(within(screen.getByRole('region', { name: /updates/i })).getAllByText('Dentist', { selector: '.entry__title' })).toHaveLength(1);

    const rows = await dentistRows();
    expect(rows).toHaveLength(1);
    const row = rows[0]!.closest('li')!;
    expect(within(row).getByText('Khodi')).toBeInTheDocument();
    expect(within(row).getByText('Kenzli')).toBeInTheDocument();
  });

  it('another adult editing it keeps the creator, records the editor, and does not duplicate the event', async () => {
    render(<App />);
    await chooseAndSkip('Jay');
    await addTwinUpdate();
    await fireEvent.change(screen.getByLabelText(/viewing as/i), { target: { value: 'fallon' } });
    expect(screen.getByRole('heading', { name: /add your work schedule/i })).toBeInTheDocument(); // Fallon has not done setup on this device
    await click(/skip for now/i);
    expect(screen.getByText(/using the cottage as/i)).toHaveTextContent('Fallon');
    await openHousehold();
    await click(/khodi/i);
    await click(/edit dentist/i);
    await type('Title', 'Dentist (moved)', within(screen.getByRole('dialog')));
    await click(/save update/i, within(screen.getByRole('dialog')));
    const list = screen.getByRole('region', { name: /updates/i });
    expect(within(list).getByText(/added by jay/i)).toBeInTheDocument();
    expect(within(list).getByText(/edited by fallon/i)).toBeInTheDocument();
    const rows = await dentistRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Dentist (moved)');
  });

  it('validates: needs a title, and a date needs a time', async () => {
    render(<App />);
    await chooseAndSkip('Jay');
    await openHousehold();
    await click(/kenzli/i);
    await click(/add an update/i);
    const dlg = within(screen.getByRole('dialog'));
    await click(/save update/i, dlg);
    expect(dlg.getByRole('alert')).toHaveTextContent(/add a title/i);
    await type('Title', 'Picture day', dlg);
    await type('Date (optional)', '2026-10-05', dlg);
    await click(/save update/i, dlg);
    expect(dlg.getByRole('alert')).toHaveTextContent(/add a time/i);
  });
});

describe('Fran', () => {
  it('is a trusted contact with no invented details, and contacting her is not confirmed childcare', async () => {
    render(<App />);
    await chooseAndSkip('Jay');
    await openHousehold();
    const trusted = screen.getByRole('region', { name: /trusted contacts/i });
    expect(within(trusted).getByText('Fran')).toBeInTheDocument();
    expect(within(trusted).getByText(/preferred backup nanny · no contact details yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /fran/i, description: /account/i })).not.toBeInTheDocument();

    await click(/fran/i);
    expect(screen.getByText(/their only nanny since birth/i)).toBeInTheDocument();
    expect(screen.getAllByText(/not added yet/i)).toHaveLength(2);
    expect(screen.getByText(/is not confirmed childcare/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm|book|assign|available/i })).not.toBeInTheDocument();

    await click(/add contact details/i);
    await type('Phone', '555-0142', within(screen.getByRole('dialog')));
    await click(/save details/i, within(screen.getByRole('dialog')));
    expect(screen.getByText('555-0142')).toBeInTheDocument();
    expect(screen.getByText(/last edited by jay/i)).toBeInTheDocument();

    // Home is unchanged: the 3:30 pickup is still an open need.
    await click(/home/i, within(screen.getByRole('navigation', { name: /main/i })));
    expect(within(screen.getByRole('region', { name: /needs attention/i })).getByRole('button', { name: /Kenzli pickup/i })).toBeInTheDocument();
  });
});
