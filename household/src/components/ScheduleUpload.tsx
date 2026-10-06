import { useRef, useState } from 'react';
import type { WorkEntry } from '../data/types';
import { type Candidate, type ScheduleReader, toCandidates } from '../lib/scheduleUpload';
import { type ShiftInput, toDateKey, validateShift } from '../lib/schedules';

const day = (d: string) => new Date(`${d}T00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const time = (t: string) => new Date(`2000-01-01T${t}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const describe = (i: ShiftInput) =>
  `${day(i.date)} · ${time(i.start)} to ${i.endDate !== i.date ? `${day(i.endDate)} ` : ''}${time(i.end)}`;

type Phase = { kind: 'pick' } | { kind: 'reading'; name: string } | { kind: 'review'; rows: Candidate[]; warnings: string[] };

/**
 * Upload a PDF or photo of a work schedule, review what was read, save only what's kept.
 * Nothing is saved until the person taps Save.
 */
export function ScheduleUpload({
  reader,
  memberName,
  existing,
  now,
  onSave,
  onDone,
}: {
  reader: ScheduleReader;
  memberName: string;
  existing: WorkEntry[];
  now: Date;
  /** Saves one shift; resolves to whether it was stored. */
  onSave: (input: ShiftInput) => Promise<boolean>;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'pick' });
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function read(file: File) {
    setError(null);
    setPhase({ kind: 'reading', name: file.name });
    try {
      const result = await reader(file, memberName, toDateKey(now));
      setPhase({ kind: 'review', rows: toCandidates(result, existing), warnings: result.warnings });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The schedule couldn’t be read.');
      setPhase({ kind: 'pick' });
    }
  }

  if (phase.kind !== 'review') {
    return (
      <div className="form">
        <p>Choose a PDF, a screenshot or a photo of your schedule. You’ll check every shift before anything is saved.</p>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void read(f);
          }}
        />
        {error && <p className="form__error" role="alert">{error}</p>}
        <div className="form__actions">
          <button type="button" className="btn btn-primary" disabled={phase.kind === 'reading'} onClick={() => fileRef.current?.click()}>
            {phase.kind === 'reading' ? 'Reading your schedule…' : error ? 'Try another file' : 'Choose a file'}
          </button>
          <button type="button" className="btn btn-quiet" onClick={onDone} disabled={phase.kind === 'reading'}>Cancel</button>
        </div>
        {phase.kind === 'reading' && <p className="account__note" role="status">Reading {phase.name}. This can take up to half a minute.</p>}
      </div>
    );
  }

  const { rows, warnings } = phase;
  const setRows = (next: Candidate[]) => setPhase({ ...phase, rows: next });
  const update = (key: string, patch: Partial<ShiftInput>) =>
    setRows(rows.map((r) => {
      if (r.key !== key) return r;
      const input = { ...r.input, ...patch };
      const err = validateShift(input);
      return { ...r, input, error: err, keep: err ? false : r.keep };
    }));
  const kept = rows.filter((r) => r.keep && !r.error);

  async function save() {
    setSaving(true);
    setError(null);
    let left = rows;
    try {
      for (const r of kept) {
        if (!(await onSave(r.input))) {
          setError('A shift didn’t save. The ones still listed weren’t saved; try again.');
          setRows(left);
          return;
        }
        left = left.filter((x) => x.key !== r.key);
      }
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="form">
      {rows.length === 0 ? (
        <p className="form__error" role="alert">No shifts for {memberName} were found in that file.</p>
      ) : (
        <p>Found {rows.length} shift{rows.length === 1 ? '' : 's'}. Untick anything that’s wrong, or edit it.</p>
      )}
      {warnings.length > 0 && (
        <ul className="upload__warnings" aria-label="Notes from reading">
          {warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
      {rows.length > 0 && (
        <ul className="entries">
          {rows.map((r) => (
            <li key={r.key} className="entry upload__row">
              <label className="check upload__check">
                <input
                  type="checkbox"
                  checked={r.keep}
                  disabled={!!r.error}
                  onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, keep: e.target.checked } : x)))}
                />
                <span>
                  <span className="entry__title">{describe(r.input)}</span>
                  {r.note && <span className="entry__meta"> · {r.note}</span>}
                  {r.duplicate && <span className="entry__meta"> · Already saved</span>}
                  {r.error && <span className="upload__problem">{r.error}</span>}
                </span>
              </label>
              <button type="button" className="btn btn-quiet" onClick={() => setEditing(editing === r.key ? null : r.key)}>
                {editing === r.key ? 'Done' : 'Edit'}
              </button>
              {editing === r.key && (
                <div className="upload__edit">
                  <input className="input" type="date" aria-label="Start date" value={r.input.date} onChange={(e) => update(r.key, { date: e.target.value })} />
                  <input className="input" type="time" aria-label="Start time" value={r.input.start} onChange={(e) => update(r.key, { start: e.target.value })} />
                  <input className="input" type="date" aria-label="End date" value={r.input.endDate} onChange={(e) => update(r.key, { endDate: e.target.value })} />
                  <input className="input" type="time" aria-label="End time" value={r.input.end} onChange={(e) => update(r.key, { end: e.target.value })} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="form__error" role="alert">{error}</p>}
      <div className="form__actions">
        <button type="button" className="btn btn-primary" disabled={saving || kept.length === 0} onClick={() => void save()}>
          {saving ? 'Saving…' : `Save ${kept.length} shift${kept.length === 1 ? '' : 's'}`}
        </button>
        <button type="button" className="btn btn-quiet" disabled={saving} onClick={() => setPhase({ kind: 'pick' })}>Use a different file</button>
        <button type="button" className="link-btn" disabled={saving} onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}
