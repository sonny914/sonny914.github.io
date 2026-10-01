// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';

// 2:00 PM on a Thursday, so the seeded day has a known past, present and future.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 1, 14, 0));
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('The Cottage home', () => {
  it('attributes the mail check to whoever is viewing, and can undo it', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/viewing as/i), { target: { value: 'adult3' } });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Adult 3');

    fireEvent.click(screen.getByRole('button', { name: /mark as checked/i }));
    const mail = screen.getByRole('region', { name: /mail is checked/i });
    expect(within(mail).getByText('Adult 3')).toBeInTheDocument();

    fireEvent.click(within(mail).getByRole('button', { name: /undo/i }));
    expect(screen.getByRole('heading', { name: /mail needs to be checked/i })).toBeInTheDocument();
    expect(screen.getByText(/last checked by/i)).toHaveTextContent('Fallon');
  });

  it('lets the person viewing cover a coverage gap and updates the count', () => {
    render(<App />);
    const attention = screen.getByRole('region', { name: /needs attention/i });
    const before = Number(within(attention).getByText(/^\s*·?\s*\d+$/).textContent?.replace(/\D/g, ''));
    fireEvent.click(within(attention).getByRole('button', { name: /I’ll cover: Kenzli pickup/i }));
    expect(within(attention).queryByRole('button', { name: /Kenzli pickup/i })).not.toBeInTheDocument();
    expect(within(attention).getByRole('status')).toHaveTextContent(/Jay will cover/);
    expect(Number(within(attention).getByText(/^\s*·?\s*\d+$/).textContent?.replace(/\D/g, ''))).toBe(before - 1);
    fireEvent.click(within(attention).getByRole('button', { name: /undo/i }));
    expect(within(attention).getByRole('button', { name: /I’ll cover: Kenzli pickup/i })).toBeInTheDocument();
    expect(Number(within(attention).getByText(/^\s*·?\s*\d+$/).textContent?.replace(/\D/g, ''))).toBe(before);
  });

  it('filters the day by household member', () => {
    render(<App />);
    const filters = screen.getByRole('group', { name: /show schedule for/i });
    for (const name of ['Everyone', 'Jay', 'Fallon', 'Adult 3', 'Khodi', 'Kenzli']) {
      expect(within(filters).getByRole('button', { name })).toBeInTheDocument();
    }
    fireEvent.click(within(filters).getByRole('button', { name: 'Khodi' }));
    const today = screen.getByRole('region', { name: /^today/i });
    expect(within(today).getByText('Pick up Khodi from school')).toBeInTheDocument();
    expect(within(today).queryByText('Pick up Kenzli from daycare')).not.toBeInTheDocument();
  });

  it('opens the Add sheet with the five options, closes on Escape, and keeps the nav', () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: /^add$/i })[0]!);
    const dialog = screen.getByRole('dialog', { name: /add to the board/i });
    for (const label of ['Event', 'Work schedule', 'Appointment', 'Coverage need', 'Reminder']) {
      expect(within(dialog).getByText(label)).toBeInTheDocument();
    }
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('navigation', { name: /main/i })).getByRole('button', { name: /calendar/i }));
    expect(screen.getByRole('heading', { level: 1, name: 'Calendar' })).toBeInTheDocument();
  });
});
