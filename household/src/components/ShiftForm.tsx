import { useState } from 'react';
import type { WorkEntry } from '../data/types';
import { type ShiftInput, WEEKDAYS, validateShift } from '../lib/schedules';
import { Field } from './Field';

const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fromEntry(e?: WorkEntry): ShiftInput {
  return {
    date: e?.date ?? '',
    start: e?.start ?? '',
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
  onSave: (input: ShiftInput) => void;
  onDelete?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [v, setV] = useState<ShiftInput>(() => fromEntry(entry));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ShiftInput>(k: K, val: ShiftInput[K]) => setV((p) => ({ ...p, [k]: val }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateShift(v);
    setError(err);
    if (!err) onSave(v);
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <Field label={v.repeats ? 'First date' : 'Date'}>
        <input className="input" type="date" value={v.date} onChange={(e) => set('date', e.target.value)} />
      </Field>
      <div className="form__row">
        <Field label="Start time">
          <input className="input" type="time" value={v.start} onChange={(e) => set('start', e.target.value)} />
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
        <button type="submit" className="btn btn-primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>}
        {onDelete && <button type="button" className="link-btn" onClick={onDelete}>Delete this shift</button>}
      </div>
    </form>
  );
}
