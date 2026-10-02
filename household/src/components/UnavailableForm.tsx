import { useState } from 'react';
import type { UnavailablePeriod } from '../data/types';
import { Field } from './Field';

export interface UnavailableInput {
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  note: string;
}

export function toUnavailableInput(u?: UnavailablePeriod): UnavailableInput {
  return {
    startDate: u?.start.slice(0, 10) ?? '',
    endDate: u?.end.slice(0, 10) ?? '',
    allDay: u?.allDay ?? true,
    startTime: u && !u.allDay ? u.start.slice(11, 16) : '',
    endTime: u && !u.allDay ? u.end.slice(11, 16) : '',
    note: u?.note ?? '',
  };
}

export function validateUnavailable(i: UnavailableInput): string | null {
  if (!i.startDate || !i.endDate) return 'Choose a first and last date.';
  if (i.endDate < i.startDate) return 'The last date must be on or after the first date.';
  if (!i.allDay) {
    if (!i.startTime || !i.endTime) return 'Enter a start and end time, or choose all day.';
    if (i.startDate === i.endDate && i.endTime <= i.startTime) return 'End time must be after the start time.';
  }
  return null;
}

export function UnavailableForm({
  period,
  onSave,
  onDelete,
  onCancel,
}: {
  period?: UnavailablePeriod;
  onSave: (i: UnavailableInput) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<UnavailableInput>(() => toUnavailableInput(period));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof UnavailableInput>(k: K, val: UnavailableInput[K]) => setV((p) => ({ ...p, [k]: val }));
  return (
    <form
      className="form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const err = validateUnavailable(v);
        setError(err);
        if (!err) onSave(v);
      }}
    >
      <div className="form__row">
        <Field label="First date">
          <input className="input" type="date" value={v.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </Field>
        <Field label="Last date">
          <input className="input" type="date" value={v.endDate} onChange={(e) => set('endDate', e.target.value)} />
        </Field>
      </div>
      <label className="check">
        <input type="checkbox" checked={v.allDay} onChange={(e) => set('allDay', e.target.checked)} />
        <span>All day</span>
      </label>
      {!v.allDay && (
        <div className="form__row">
          <Field label="Start time">
            <input className="input" type="time" value={v.startTime} onChange={(e) => set('startTime', e.target.value)} />
          </Field>
          <Field label="End time">
            <input className="input" type="time" value={v.endTime} onChange={(e) => set('endTime', e.target.value)} />
          </Field>
        </div>
      )}
      <Field label="Note (optional)">
        <input className="input" type="text" value={v.note} onChange={(e) => set('note', e.target.value)} />
      </Field>
      {error && <p className="form__error" role="alert">{error}</p>}
      <div className="form__actions">
        <button type="submit" className="btn btn-primary">Save</button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>
        {onDelete && <button type="button" className="link-btn" onClick={onDelete}>Delete this period</button>}
      </div>
    </form>
  );
}
