import { useState } from 'react';
import { ShiftForm } from '../components/ShiftForm';
import type { HouseholdMember, WorkEntry } from '../data/types';
import { shiftToEntry } from '../lib/records';
import { describeWorkEntry } from '../lib/schedules';

/** Step two of first-time setup, right after "Who are you?". */
export function ScheduleOnboardingScreen({
  me,
  entries,
  now,
  onSave,
  onFinish,
  onSkip,
  where,
}: {
  me: HouseholdMember;
  entries: WorkEntry[];
  now: Date;
  onSave: (entry: WorkEntry) => Promise<boolean>;
  onFinish: () => Promise<boolean>;
  onSkip: () => Promise<boolean>;
  /** Where saved shifts live, in plain words (demo: this device only; shared: with the other adults). */
  where: string;
}) {
  const [adding, setAdding] = useState(false);
  const mine = entries.filter((e) => e.memberId === me.id);

  return (
    <main className="gate" id="main">
      <p className="masthead__eyebrow">Welcome, {me.name}</p>
      <h1 className="gate__heading">Add your work schedule.</h1>
      <p className="gate__lead">
        Your shifts show on the day board and tell the household when you can and can’t cover a pickup. You can change them any time from Household.
      </p>

      {mine.length > 0 && (
        <ul className="gate__saved" aria-label="Shifts you added">
          {mine.map((e) => (
            <li key={e.id}>{describeWorkEntry(e)}</li>
          ))}
        </ul>
      )}

      {adding ? (
        <ShiftForm
          submitLabel="Save shift"
          onCancel={() => setAdding(false)}
          onSave={async (i) => {
            if (await onSave(shiftToEntry(i, me.id, me.id, now))) setAdding(false);
          }}
        />
      ) : (
        <div className="form__actions">
          {mine.length === 0 ? (
            <>
              <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>Add my shifts</button>
              <button type="button" className="btn btn-quiet" onClick={() => void onSkip()}>Skip for now</button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-primary" onClick={() => void onFinish()}>Done</button>
              <button type="button" className="btn btn-quiet" onClick={() => setAdding(true)}>Add another shift</button>
            </>
          )}
        </div>
      )}

      <p className="gate__note">
        Photo and PDF upload, and reading a posted schedule for you, come in the next update. For now shifts are entered by hand.
        {where}
      </p>
    </main>
  );
}
