import { useState } from 'react';
import { useSubmit } from '../hooks/useSubmit';
import type { TrustedContact } from '../data/types';
import { Field } from './Field';

export function ContactForm({
  contact,
  onSave,
  onCancel,
}: {
  contact: TrustedContact;
  onSave: (patch: Pick<TrustedContact, 'phone' | 'email' | 'notes'>) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [phone, setPhone] = useState(contact.phone ?? '');
  const [email, setEmail] = useState(contact.email ?? '');
  const [notes, setNotes] = useState(contact.notes ?? '');
  const { busy, run } = useSubmit();
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (busy) return;
        void run(() => onSave({ phone: phone.trim() || undefined, email: email.trim() || undefined, notes: notes.trim() || undefined }));
      }}
    >
      <Field label="Phone">
        <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label="Email">
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Notes (optional)" hint="Anything the household should know. Do not record availability here; confirm that with her each time.">
        <textarea className="input input--area" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="form__actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save details'}</button>
        <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}
