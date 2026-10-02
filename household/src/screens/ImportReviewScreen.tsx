import { useMemo, useState } from 'react';
import type { HouseholdRepository } from '../data/repository';
import type { HouseholdSnapshot, MemberId } from '../data/types';
import { readLocalDemoState, removeLocalDemoRecords } from '../data/repository';
import { saveErrorMessage } from '../data/errors';
import { type ImportItem, buildImportPlan } from '../import/plan';
import { useSubmit } from '../hooks/useSubmit';

type Outcome = { ok: true } | { ok: false; message: string };

/**
 * Review before anything leaves this browser. Nothing is selected by default and nothing is uploaded
 * until a person ticks records and presses Import. Imported records are saved as added by the signed-in
 * account. Removing the local copies is a separate, confirmed step.
 */
export function ImportReviewScreen({
  repo,
  me,
  shared,
  onDone,
  onImported,
}: {
  repo: HouseholdRepository;
  me: MemberId;
  shared: HouseholdSnapshot;
  onDone: () => void;
  onImported: () => Promise<void>;
}) {
  const local = useMemo(() => readLocalDemoState(), []);
  const items = useMemo(() => buildImportPlan(local, me, shared), [local, me, shared]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const { busy, run } = useSubmit();

  const selectable = items.filter((i) => !i.blocked && !outcomes[i.key]?.ok);
  const importedKeys = Object.entries(outcomes).filter(([, o]) => o.ok).map(([k]) => k);

  const toggle = (key: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  async function apply(item: ImportItem): Promise<Outcome> {
    try {
      const r = item.record;
      if (r.kind === 'work') await repo.saveWorkEntry(r.entry);
      if (r.kind === 'away') await repo.saveUnavailable(r.period);
      if (r.kind === 'update') await repo.saveChildUpdate(r.update);
      if (r.kind === 'contact') {
        const cur = shared.trustedContacts.find((c) => c.id === r.id);
        await repo.saveContact(r.id, { phone: r.patch.phone ?? cur?.phone, email: r.patch.email ?? cur?.email, notes: r.patch.notes ?? cur?.notes }, me, new Date());
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, message: saveErrorMessage(e) };
    }
  }

  function importSelected() {
    void run(async () => {
      const results: Record<string, Outcome> = { ...outcomes };
      for (const item of selectable.filter((i) => picked.has(i.key))) results[item.key] = await apply(item);
      setOutcomes(results);
      setPicked(new Set());
      await onImported();
    });
  }

  function removeCopies() {
    try {
      removeLocalDemoRecords(importedKeys);
      setRemoved(true);
      setConfirmRemove(false);
    } catch (e) {
      setRemoveError(saveErrorMessage(e));
    }
  }

  return (
    <main className="gate" id="main">
      <p className="masthead__eyebrow">The Cottage</p>
      <h1 className="gate__heading">Review records on this device.</h1>
      <p className="gate__lead">
        This browser holds records saved while The Cottage ran as a single-device demo. They have <strong>not</strong> been uploaded. Choose which to add to the shared household.
        Imported records are saved as added by you. Sample events, coverage actions and mail checks are not imported.
      </p>

      {items.length === 0 ? (
        <p className="gate__note">There is nothing to import.</p>
      ) : (
        <ul className="import" aria-label="Records on this device">
          {items.map((i) => {
            const outcome = outcomes[i.key];
            const id = `imp-${i.key}`;
            return (
              <li key={i.key} className="import__item">
                <input
                  id={id}
                  type="checkbox"
                  className="import__check"
                  checked={picked.has(i.key) || !!outcome?.ok}
                  disabled={!!i.blocked || !!outcome?.ok || busy}
                  onChange={() => toggle(i.key)}
                />
                <label htmlFor={id} className="import__text">
                  <span className="import__title">{i.title}</span>
                  <span className="import__detail">{i.detail}</span>
                  {i.blocked && <span className="import__blocked">{i.blocked}</span>}
                  {outcome?.ok && <span className="import__done">Imported.</span>}
                  {outcome && !outcome.ok && <span className="import__blocked" role="alert">{outcome.message}</span>}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className="form__actions">
        <button type="button" className="btn btn-primary" disabled={busy || picked.size === 0} onClick={importSelected}>
          {busy ? 'Importing…' : `Import selected (${picked.size})`}
        </button>
        <button type="button" className="btn btn-quiet" onClick={onDone} disabled={busy}>{importedKeys.length ? 'Done' : 'Not now'}</button>
      </div>

      {importedKeys.length > 0 && !removed && (
        <div className="gate__note">
          {!confirmRemove ? (
            <>
              <p>Imported {importedKeys.length} {importedKeys.length === 1 ? 'record' : 'records'}. The copies on this device are still here. Remove them?</p>
              <button type="button" className="btn btn-quiet" onClick={() => setConfirmRemove(true)}>Remove imported copies from this device</button>
            </>
          ) : (
            <>
              <p>Remove {importedKeys.length} imported {importedKeys.length === 1 ? 'copy' : 'copies'} from this device? Records you did not import are kept.</p>
              <div className="form__actions">
                <button type="button" className="btn btn-primary" onClick={removeCopies}>Yes, remove them</button>
                <button type="button" className="btn btn-quiet" onClick={() => setConfirmRemove(false)}>Keep them</button>
              </div>
            </>
          )}
          {removeError && <p className="form__error" role="alert">{removeError}</p>}
        </div>
      )}
      {removed && <p className="gate__note" role="status">Removed the imported copies from this device.</p>}
    </main>
  );
}
