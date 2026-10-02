import { useState } from 'react';
import { useSubmit } from '../hooks/useSubmit';
import type { ChildUpdate, ChildUpdateType, HouseholdMember, MemberId } from '../data/types';
import { UPDATE_TYPES } from '../lib/schedules';
import { Field } from './Field';

export interface ChildUpdateInput {
  childIds: MemberId[];
  type: ChildUpdateType;
  title: string;
  note: string;
  date: string;
  time: string;
}

export function ChildUpdateForm({
  kids,
  startWith,
  update,
  onSave,
  onDelete,
  onCancel,
}: {
  kids: HouseholdMember[];
  startWith: MemberId;
  update?: ChildUpdate;
  onSave: (i: ChildUpdateInput) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [v, setV] = useState<ChildUpdateInput>(() => ({
    childIds: update?.childIds ?? [startWith],
    type: update?.type ?? 'note',
    title: update?.title ?? '',
    note: update?.note ?? '',
    date: update?.at?.slice(0, 10) ?? '',
    time: update?.at?.slice(11, 16) ?? '',
  }));
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useSubmit();
  const set = <K extends keyof ChildUpdateInput>(k: K, val: ChildUpdateInput[K]) => setV((p) => ({ ...p, [k]: val }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const err =
      v.childIds.length === 0 ? 'Choose at least one child.'
      : !v.title.trim() ? 'Add a title.'
      : v.date && !v.time ? 'Add a time, or clear the date.'
      : !v.date && v.time ? 'Add a date, or clear the time.'
      : null;
    setError(err);
    if (!err) void run(() => onSave({ ...v, title: v.title.trim(), note: v.note.trim() }));
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <fieldset className="who">
        <legend className="field__label">For</legend>
        {kids.map((k) => (
          <label key={k.id} className="check">
            <input
              type="checkbox"
              checked={v.childIds.includes(k.id)}
              onChange={(e) => set('childIds', e.target.checked ? [...v.childIds, k.id] : v.childIds.filter((x) => x !== k.id))}
            />
            <span>{k.name}</span>
          </label>
        ))}
        <span className="field__hint">Choose both for one shared update. It is saved once.</span>
      </fieldset>
      <Field label="Type">
        <select className="input" value={v.type} onChange={(e) => set('type', e.target.value as ChildUpdateType)}>
          {UPDATE_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Title">
        <input className="input" type="text" value={v.title} onChange={(e) => set('title', e.target.value)} />
      </Field>
      <Field label="Note (optional)">
        <textarea className="input input--area" rows={3} value={v.note} onChange={(e) => set('note', e.target.value)} />
      </Field>
      <div className="form__row">
        <Field label="Date (optional)">
          <input className="input" type="date" value={v.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Time">
          <input className="input" type="time" value={v.time} onChange={(e) => set('time', e.target.value)} />
        </Field>
      </div>
      <p className="field__hint">A dated update also appears once on the shared calendar.</p>
      {error && <p className="form__error" role="alert">{error}</p>}
      <div className="form__actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save update'}</button>
        <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>Cancel</button>
        {onDelete && <button type="button" className="link-btn" onClick={() => void run(onDelete)} disabled={busy}>Delete this update</button>}
      </div>
    </form>
  );
}
