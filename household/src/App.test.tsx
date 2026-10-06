// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { fireEvent } from './testing/events';
import App from './App';

// 2:00 PM on a Thursday, so the seeded day has a known past, present and future.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 1, 14, 0));
  window.localStorage.clear();
  // Existing tests are about Home, so start as returning users who finished setup.
  window.localStorage.setItem('cottage.demo.viewingAs.v1', 'jay');
  window.localStorage.setItem('cottage.demo.v1', JSON.stringify({ setup: { jay: 'skipped', fallon: 'skipped', adult3: 'skipped' } }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('The Cottage home', () => {
  it('attributes the mail check to whoever is viewing, and can undo it', async () => {
    render(<App />);
    await fireEvent.change(screen.getByLabelText(/viewing as/i), { target: { value: 'adult3' } });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Breeze');

    await fireEvent.click(screen.getByRole('button', { name: /mark as checked/i }));
    const mail = screen.getByRole('region', { name: /mail is checked/i });
    expect(within(mail).getByText('Breeze')).toBeInTheDocument();

    await fireEvent.click(within(mail).getByRole('button', { name: /undo/i }));
    expect(screen.getByRole('heading', { name: /mail needs to be checked/i })).toBeInTheDocument();
    expect(screen.getByText(/last checked by/i)).toHaveTextContent('Fallon');
  });

  it('lets the person viewing cover a coverage gap and updates the count', async () => {
    render(<App />);
    const attention = screen.getByRole('region', { name: /needs attention/i });
    const before = Number(within(attention).getByText(/^\s*·?\s*\d+$/).textContent?.replace(/\D/g, ''));
    await fireEvent.click(within(attention).getByRole('button', { name: /(I’ll cover|Cover anyway): Kenzli pickup/i }));
    expect(within(attention).queryByRole('button', { name: /Kenzli pickup/i })).not.toBeInTheDocument();
    expect(within(attention).getByRole('status')).toHaveTextContent(/Jay will cover/);
    expect(Number(within(attention).getByText(/^\s*·?\s*\d+$/).textContent?.replace(/\D/g, ''))).toBe(before - 1);
    await fireEvent.click(within(attention).getByRole('button', { name: /undo/i }));
    expect(within(attention).getByRole('button', { name: /(I’ll cover|Cover anyway): Kenzli pickup/i })).toBeInTheDocument();
    expect(Number(within(attention).getByText(/^\s*·?\s*\d+$/).textContent?.replace(/\D/g, ''))).toBe(before);
  });

  it('filters the day by household member', async () => {
    render(<App />);
    const filters = screen.getByRole('group', { name: /show schedule for/i });
    for (const name of ['Everyone', 'Jay', 'Fallon', 'Breeze', 'Khodi', 'Kenzli']) {
      expect(within(filters).getByRole('button', { name })).toBeInTheDocument();
    }
    await fireEvent.click(within(filters).getByRole('button', { name: 'Khodi' }));
    const today = screen.getByRole('region', { name: /^today/i });
    expect(within(today).getByText('Pick up Khodi from school')).toBeInTheDocument();
    expect(within(today).queryByText('Pick up Kenzli from daycare')).not.toBeInTheDocument();
  });

  it('opens the Add sheet with the five options, closes on Escape, and keeps the nav', async () => {
    render(<App />);
    await fireEvent.click(screen.getAllByRole('button', { name: /^add$/i })[0]!);
    const dialog = screen.getByRole('dialog', { name: /add to the board/i });
    for (const label of ['Event', 'Work schedule', 'Appointment', 'Coverage need', 'Reminder']) {
      expect(within(dialog).getByText(label)).toBeInTheDocument();
    }
    await fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await fireEvent.click(within(screen.getByRole('navigation', { name: /main/i })).getByRole('button', { name: /calendar/i }));
    expect(screen.getByRole('heading', { level: 1, name: 'Calendar' })).toBeInTheDocument();
  });
});

describe('Trash and recycling', () => {
  it('is quiet at 2 PM Thursday, then reminds the evening before Friday pickup', async () => {
    const view = render(<App />);
    expect(screen.queryByRole('region', { name: /trash and recycling/i })).not.toBeInTheDocument();
    view.unmount();
    vi.setSystemTime(new Date(2026, 9, 1, 19, 0)); // Thursday 7 PM
    render(<App />);
    const strip = screen.getByRole('region', { name: /trash and recycling/i });
    expect(strip).toHaveTextContent('Tonight: put out the trash and recycling');
    expect(strip).toHaveTextContent('Pickup is tomorrow, Friday.');
  });
});

describe('Pickup clarity', () => {
  it('tells the viewer they are at work and relabels the action instead of offering a plain "I\u2019ll cover"', async () => {
    render(<App />);
    const attention = screen.getByRole('region', { name: /needs attention/i });
    expect(within(attention).getByText(/You’re at work until 4:30 PM\. No one else is free\./)).toBeInTheDocument();
    expect(within(attention).getByRole('button', { name: /Cover anyway: Kenzli pickup/i })).toBeInTheDocument();
  });

  it('shows who is free on a day that someone really can cover', async () => {
    render(<App />);
    await fireEvent.click(screen.getByRole('button', { name: /show \d+ more/i }));
    const attention = screen.getByRole('region', { name: /needs attention/i });
    expect(within(attention).getByText(/You’re free then\. Also free: Breeze\./)).toBeInTheDocument();
    expect(within(attention).getByRole('button', { name: /I’ll cover: Kenzli needs care/i })).toBeInTheDocument();
  });

  it('keeps the mail button quiet until a day has been missed', async () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /mark as checked/i }).className).toContain('btn-quiet');
  });
});
