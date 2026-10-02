// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

const click = (name: RegExp | string, scope: ReturnType<typeof within> | typeof screen = screen) => fireEvent.click(scope.getByRole('button', { name }));
const type = (label: RegExp | string, value: string, scope: ReturnType<typeof within> | typeof screen = screen) =>
  fireEvent.change(scope.getByLabelText(label), { target: { value } });

function chooseAndSkip(name: string) {
  click(name);
  click(/skip for now/i);
}
function openHousehold() {
  click(/^household$/i, within(screen.getByRole('navigation', { name: /main/i })));
}

describe('First-time adult setup', () => {
  it('asks "Who are you?" with the three adults and says plainly that it is not a sign-in', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /who are you\?/i })).toBeInTheDocument();
    for (const n of ['Jay', 'Fallon', 'Breeze']) expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /khodi|kenzli|fran/i })).not.toBeInTheDocument();
    expect(screen.getByText(/not a\s+sign-in/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it('then asks for a work schedule, offers manual entry and skip, and has no fake upload button', () => {
    render(<App />);
    click('Breeze');
    expect(screen.getByRole('heading', { name: /add your work schedule/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add my shifts/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upload|photo|pdf|scan/i })).not.toBeInTheDocument();
    expect(screen.getByText(/come in the next update/i)).toBeInTheDocument();
  });

  it('skipping goes to Home, and a returning adult goes straight to Home', () => {
    const first = render(<App />);
    chooseAndSkip('Breeze');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Breeze');
    first.unmount();
    render(<App />);
    expect(screen.queryByRole('heading', { name: /who are you/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /add your work schedule/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Breeze');
  });

  it('can switch person from Household, which returns to "Who are you?"', () => {
    render(<App />);
    chooseAndSkip('Jay');
    openHousehold();
    expect(screen.getByText(/demo mode: this is a name saved in this browser, not a sign-in/i)).toBeInTheDocument();
    click(/switch person/i);
    expect(screen.getByRole('heading', { name: /who are you\?/i })).toBeInTheDocument();
    click('Fallon');
    expect(screen.getByRole('heading', { name: /add your work schedule/i })).toBeInTheDocument();
  });
});

describe('Manual work schedule', () => {
  it('validates, saves through onboarding, and Home reflects the shift', () => {
    render(<App />);
    click('Breeze');
    click(/add my shifts/i);
    type('Date', '2026-10-02');
    type('Start time', '17:00');
    type('End time', '09:00');
    click(/save shift/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/overnight/i);
    type('Start time', '09:00');
    type('End time', '17:00');
    click(/save shift/i);
    expect(screen.getByLabelText(/shifts you added/i)).toHaveTextContent('Fri, Oct 2 · 9:00 AM to 5:00 PM');
    click(/^done$/i);

    const upcoming = screen.getByRole('region', { name: /next 7 days/i });
    const mine = within(upcoming).getAllByRole('heading', { name: 'Work shift' }).filter((h) => within(h.closest('li')!).queryByText('Breeze'));
    expect(mine).toHaveLength(1);
    expect(within(mine[0]!.closest('li')!).getByText('9:00 AM')).toBeInTheDocument();
  });

  it('supports weekly repeats, editing without duplicates, and persists across a reload', () => {
    const first = render(<App />);
    chooseAndSkip('Breeze');
    click(/update my schedule/i);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Breeze');
    click(/^update my schedule$/i);
    const dlg = within(screen.getByRole('dialog'));
    type('Date', '2026-10-02', dlg);
    type('Start time', '09:00', dlg);
    type('End time', '17:00', dlg);
    fireEvent.click(dlg.getByLabelText(/repeats every week/i));
    for (const d of ['Monday', 'Wednesday', 'Friday']) click(d, dlg);
    click(/save shift/i, dlg);
    expect(screen.getByText('Every Mon, Wed, Fri · 9:00 AM to 5:00 PM')).toBeInTheDocument();

    const breezeRows = () => {
      click(/home/i, within(screen.getByRole('navigation', { name: /main/i })));
      const upcoming = screen.getByRole('region', { name: /next 7 days/i });
      return within(upcoming).getAllByRole('heading', { name: 'Work shift' }).filter((h) => within(h.closest('li')!).queryByText('Breeze'));
    };
    expect(breezeRows()).toHaveLength(3); // Fri 2, Mon 5, Wed 7

    openHousehold();
    click(/breeze/i);
    click(/edit shift/i);
    type('End time', '15:00', within(screen.getByRole('dialog')));
    click(/save shift/i, within(screen.getByRole('dialog')));
    expect(breezeRows()).toHaveLength(3); // edited, not duplicated
    expect(screen.getAllByText(/until 3:00 PM/).length).toBeGreaterThan(0);

    first.unmount();
    render(<App />); // persistence: same device, fresh load
    expect(breezeRows()).toHaveLength(3);
  });

  it('only the owner can edit a schedule', () => {
    render(<App />);
    chooseAndSkip('Jay');
    openHousehold();
    click(/fallon/i);
    expect(screen.getByText(/only fallon can change fallon’s schedule/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /update my schedule|add a shift/i })).not.toBeInTheDocument();
  });
});

describe('Child updates', () => {
  function addTwinUpdate() {
    openHousehold();
    click(/khodi/i);
    click(/add an update/i);
    const dlg = within(screen.getByRole('dialog'));
    fireEvent.click(dlg.getByLabelText('Kenzli')); // Khodi is preselected; add the other twin
    fireEvent.change(dlg.getByLabelText('Type'), { target: { value: 'appointment' } });
    type('Title', 'Dentist', dlg);
    type('Note (optional)', 'Bring the insurance card', dlg);
    type('Date (optional)', '2026-10-06', dlg);
    type('Time', '09:00', dlg);
    click(/save update/i, dlg);
  }
  const dentistRows = () => {
    click(/home/i, within(screen.getByRole('navigation', { name: /main/i })));
    return within(screen.getByRole('region', { name: /next 7 days/i })).queryAllByRole('heading', { name: /dentist/i });
  };

  it('one shared update for both twins appears on both profiles and once on Home, with attribution', () => {
    render(<App />);
    chooseAndSkip('Jay');
    addTwinUpdate();
    const list = screen.getByRole('region', { name: /updates/i });
    expect(within(list).getByText('Dentist', { selector: '.entry__title' })).toBeInTheDocument();
    expect(within(list).getByText(/for khodi and kenzli/i)).toBeInTheDocument();
    expect(within(list).getByText(/bring the insurance card/i)).toBeInTheDocument();
    expect(within(list).getByText(/added by jay/i)).toBeInTheDocument();

    click(/← household/i);
    click(/kenzli/i);
    expect(within(screen.getByRole('region', { name: /updates/i })).getAllByText('Dentist', { selector: '.entry__title' })).toHaveLength(1);

    const rows = dentistRows();
    expect(rows).toHaveLength(1);
    const row = rows[0]!.closest('li')!;
    expect(within(row).getByText('Khodi')).toBeInTheDocument();
    expect(within(row).getByText('Kenzli')).toBeInTheDocument();
  });

  it('another adult editing it keeps the creator, records the editor, and does not duplicate the event', () => {
    render(<App />);
    chooseAndSkip('Jay');
    addTwinUpdate();
    fireEvent.change(screen.getByLabelText(/viewing as/i), { target: { value: 'fallon' } });
    expect(screen.getByRole('heading', { name: /add your work schedule/i })).toBeInTheDocument(); // Fallon has not done setup on this device
    click(/skip for now/i);
    expect(screen.getByText(/using the cottage as/i)).toHaveTextContent('Fallon');
    openHousehold();
    click(/khodi/i);
    click(/edit dentist/i);
    type('Title', 'Dentist (moved)', within(screen.getByRole('dialog')));
    click(/save update/i, within(screen.getByRole('dialog')));
    const list = screen.getByRole('region', { name: /updates/i });
    expect(within(list).getByText(/added by jay/i)).toBeInTheDocument();
    expect(within(list).getByText(/edited by fallon/i)).toBeInTheDocument();
    const rows = dentistRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Dentist (moved)');
  });

  it('validates: needs a title, and a date needs a time', () => {
    render(<App />);
    chooseAndSkip('Jay');
    openHousehold();
    click(/kenzli/i);
    click(/add an update/i);
    const dlg = within(screen.getByRole('dialog'));
    click(/save update/i, dlg);
    expect(dlg.getByRole('alert')).toHaveTextContent(/add a title/i);
    type('Title', 'Picture day', dlg);
    type('Date (optional)', '2026-10-05', dlg);
    click(/save update/i, dlg);
    expect(dlg.getByRole('alert')).toHaveTextContent(/add a time/i);
  });
});

describe('Fran', () => {
  it('is a trusted contact with no invented details, and contacting her is not confirmed childcare', () => {
    render(<App />);
    chooseAndSkip('Jay');
    openHousehold();
    const trusted = screen.getByRole('region', { name: /trusted contacts/i });
    expect(within(trusted).getByText('Fran')).toBeInTheDocument();
    expect(within(trusted).getByText(/preferred backup nanny · no contact details yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /fran/i, description: /account/i })).not.toBeInTheDocument();

    click(/fran/i);
    expect(screen.getByText(/their only nanny since birth/i)).toBeInTheDocument();
    expect(screen.getAllByText(/not added yet/i)).toHaveLength(2);
    expect(screen.getByText(/is not confirmed childcare/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm|book|assign|available/i })).not.toBeInTheDocument();

    click(/add contact details/i);
    type('Phone', '555-0142', within(screen.getByRole('dialog')));
    click(/save details/i, within(screen.getByRole('dialog')));
    expect(screen.getByText('555-0142')).toBeInTheDocument();
    expect(screen.getByText(/last edited by jay/i)).toBeInTheDocument();

    // Home is unchanged: the 3:30 pickup is still an open need.
    click(/home/i, within(screen.getByRole('navigation', { name: /main/i })));
    expect(within(screen.getByRole('region', { name: /needs attention/i })).getByRole('button', { name: /Kenzli pickup/i })).toBeInTheDocument();
  });
});
