import type { WorkEntry } from '../data/types';
import { type ShiftInput, validateShift } from './schedules';

/** What the server returns after reading a schedule file. Nothing is saved by reading. */
export interface ReadResult {
  shifts: { date: string; start: string; endDate: string; end: string; note?: string }[];
  warnings: string[];
}

/** Reads a PDF or image and returns the shifts found for this person. Absent in the demo. */
export type ScheduleReader = (file: File, memberName: string, today: string) => Promise<ReadResult>;

/** One shift offered for review. Only kept ones are saved. */
export interface Candidate {
  key: string;
  input: ShiftInput;
  note?: string;
  /** Why it can't be saved as read (null when valid). */
  error: string | null;
  /** Same date and times as a shift already saved. */
  duplicate: boolean;
  keep: boolean;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;
const hhmm = (t: string) => (t.length === 4 ? `0${t}` : t);

/** Accepts only well-formed shifts and string warnings, whatever the server sent. */
export function parseReadResult(raw: unknown): ReadResult {
  const r = (raw ?? {}) as { shifts?: unknown; warnings?: unknown };
  const shifts: ReadResult['shifts'] = [];
  const warnings = Array.isArray(r.warnings) ? r.warnings.filter((w): w is string => typeof w === 'string' && !!w.trim()) : [];
  let dropped = 0;
  for (const s of Array.isArray(r.shifts) ? r.shifts : []) {
    const x = (s ?? {}) as Record<string, unknown>;
    const date = String(x.date ?? '');
    const endDate = String(x.endDate ?? x.date ?? '');
    const start = String(x.start ?? '');
    const end = String(x.end ?? '');
    if (!DATE.test(date) || !DATE.test(endDate) || !TIME.test(start) || !TIME.test(end)) { dropped++; continue; }
    const note = typeof x.note === 'string' && x.note.trim() ? x.note.trim().slice(0, 120) : undefined;
    shifts.push({ date, endDate, start: hhmm(start), end: hhmm(end), note });
  }
  if (dropped) warnings.push(`${dropped} item${dropped === 1 ? '' : 's'} couldn’t be read as a shift and ${dropped === 1 ? 'was' : 'were'} left out.`);
  return { shifts, warnings };
}

/** Turns read shifts into review rows: valid, new shifts start ticked; problems and repeats start unticked. */
export function toCandidates(result: ReadResult, existing: WorkEntry[]): Candidate[] {
  const saved = new Set(existing.filter((e) => !e.repeat).map((e) => `${e.date}|${e.start}|${e.endDate}|${e.end}`));
  const seen = new Set<string>();
  const out: Candidate[] = [];
  result.shifts
    .slice()
    .sort((a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`))
    .forEach((s, i) => {
      const id = `${s.date}|${s.start}|${s.endDate}|${s.end}`;
      if (seen.has(id)) return;
      seen.add(id);
      const input: ShiftInput = { date: s.date, start: s.start, endDate: s.endDate, end: s.end, repeats: false, weekdays: [], until: '' };
      const error = validateShift(input);
      const duplicate = saved.has(id);
      out.push({ key: `${i}-${id}`, input, note: s.note, error, duplicate, keep: !error && !duplicate });
    });
  return out;
}

// ---- Browser side -----------------------------------------------------------

const MAX_SIDE = 2000;
const MAX_PDF_BYTES = 6 * 1024 * 1024;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** PDFs go as they are (size-checked). Photos are shrunk on the device to a JPEG first. */
export async function prepareFile(file: File): Promise<{ data: string; mediaType: string }> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (file.size > MAX_PDF_BYTES) throw new Error('That PDF is over 6 MB. Try a smaller export or a screenshot.');
    return { data: toBase64(await file.arrayBuffer()), mediaType: 'application/pdf' };
  }
  if (!file.type.startsWith('image/')) throw new Error('Choose a PDF or a photo.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This photo format can’t be opened here. Try a screenshot or a JPEG.');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
  if (!blob) throw new Error('The photo couldn’t be prepared. Try again.');
  return { data: toBase64(await blob.arrayBuffer()), mediaType: 'image/jpeg' };
}

/** Calls the server reader with the signed-in person's token. */
export function createScheduleReader(getToken: () => Promise<string | null>, endpoint = '/api/read-schedule'): ScheduleReader {
  return async (file, memberName, today) => {
    const { data, mediaType } = await prepareFile(file);
    const token = await getToken();
    if (!token) throw new Error('You’re signed out. Sign in again, then upload.');
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ file: data, mediaType, memberName, today }),
      });
    } catch {
      throw new Error('No connection. Check your internet and try again.');
    }
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) throw new Error(body?.error ?? 'The schedule couldn’t be read. Try again, or add shifts by hand.');
    return parseReadResult(body);
  };
}
