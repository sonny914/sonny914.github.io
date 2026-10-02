import { useState } from 'react';
import { useSubmit } from '../hooks/useSubmit';
import type { WorkEntry } from '../data/types';
import { type ShiftInput, WEEKDAYS, validateShift } from '../lib/schedules';
import { Field } from './Field';

const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fromEntry(e?: WorkEntry): ShiftInput {
  return {
    date: e?.date ?? '',
    start: e?.start ?? '',
    endDate: e?.endDate ?? e?.date ?? '',
    end: e?.end ?? '',
    repeats: !!e?.repeat,
    weekdays: e?.repeat?.weekdays ?? [],
    until: e?.repeat?.until ?? '',
  };
}

/** Manual shift entry: date, start, end, optional weekly repeat. Also used to edit. */
export function ShiftForm({
  entry,
  onSave,
  onDelete,
  onCancel,
  submitLabel = 'Save shift',
}: {
  entry?: WorkEntry;
  onSave: (input: ShiftInput) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [v, setV] = useState<ShiftInput>(() => fromEntry(entry));
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useSubmit();
  // The end date follows the start date until the person sets it themselves.
  const [endEdited, setEndEdited] = useState(!!entry && entry.endDate !== entry.date);
  const set = <K extends keyof ShiftInput>(k: K, val: ShiftInput[K]) => setV((p) => ({ ...p, [k]: val }));
  const setStartDate = (d: string) => setV((p) => ({ ...p, date: d, endDate: endEdited ? p.endDate : d }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const err = validateShift(v);
    setError(err);
    if (!err) void run(() => onSave(v));
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="form__row">
        <Field label={v.repeats ? 'First start date' : 'Start date'}>
          <input className="input" type="date" value={v.date} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Start time">
          <input className="input" type="time" value={v.start} onChange={(e) => set('start', e.target.value)} />
        </Field>
      </div>
      <div className="form__row">
        <Field label="End date" hint="For an overnight shift, choose the next day.">
          <input className="input" type="date" value={v.endDate} onChange={(e) => { setEndEdited(true); set('endDate', e.target.value); }} />
        </Field>
        <Field label="End time">
          <input className="input" type="time" value={v.end} onChange={(e) => set('end', e.target.value)} />
        </Field>
      </div>
      <label className="check">
        <input type="checkbox" checked={v.repeats} onChange={(e) => set('repeats', e.target.checked)} />
        <span>Repeats every week</span>
      </label>
      {v.repeats && (
        <>
          <fieldset className="weekdays">
            <legend className="field__label">On these days</legend>
            <div className="weekdays__row">
              {WEEKDAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  className="weekday"
                  aria-pressed={v.weekdays.includes(i)}
                  aria-label={FULL_DAYS[i]}
                  onClick={() => set('weekdays', v.weekdays.includes(i) ? v.weekdays.filter((x) => x !== i) : [...v.weekdays, i])}
                >
                  {d.slice(0, 2)}
                </button>
              ))}
            </div>
          </fieldset>
          <Field label="Repeat until (optional)" hint="Leave empty to keep repeating.">
            <input className="input" type="date" value={v.until} onChange={(e) => set('until', e.target.value)} />
          </Field>
        </>
      )}
      {error && <p className="form__error" role="alert">{error}</p>}
      <div className="form__actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        {onCancel && <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>Cancel</button>}
        {onDelete && <button type="button" className="link-btn" onClick={() => void run(onDelete)} disabled={busy}>Delete this shift</button>}
      </div>
    </form>
  );
}
