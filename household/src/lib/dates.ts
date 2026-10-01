import type { LocalDateTime } from '../data/types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toLocal(d: Date): LocalDateTime {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parses "YYYY-MM-DDTHH:mm" as local time. */
export function parseLocal(s: LocalDateTime): Date {
  const [datePart = '', timePart = '00:00'] = s.split('T');
  const [y = 0, m = 1, d = 1] = datePart.split('-').map(Number);
  const [hh = 0, mm = 0] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
}

/** Local datetime string for `days` from `base`'s date at hh:mm. */
export function at(base: Date, days: number, hh: number, mm = 0): LocalDateTime {
  const d = addDays(startOfDay(base), days);
  d.setHours(hh, mm, 0, 0);
  return toLocal(d);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000);
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatLongDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatDayHeading(d: Date, today: Date): string {
  const diff = dayDiff(d, today);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  const short = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (diff === 1) return `Tomorrow · ${short}`;
  return `${weekday} · ${short}`;
}

/** "Today" / "Yesterday" / "Tomorrow" / "Mon". */
export function formatDay(d: Date, today: Date): string {
  const diff = dayDiff(d, today);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

/** "Today, 3:15 PM" / "Yesterday, 5:40 PM" / "Mon, 9:00 AM". */
export function formatWhen(d: Date, today: Date): string {
  return `${formatDay(d, today)}, ${formatTime(d)}`;
}

export function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
