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
}: {
  me: HouseholdMember;
  entries: WorkEntry[];
  now: Date;
  onSave: (entry: WorkEntry) => boolean;
  onFinish: () => boolean;
  onSkip: () => boolean;
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
          onSave={(i) => {
            if (onSave(shiftToEntry(i, me.id, me.id, now))) setAdding(false);
          }}
        />
      ) : (
        <div className="form__actions">
          {mine.length === 0 ? (
            <>
              <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>Add my shifts</button>
              <button type="button" className="btn btn-quiet" onClick={onSkip}>Skip for now</button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-primary" onClick={onFinish}>Done</button>
              <button type="button" className="btn btn-quiet" onClick={() => setAdding(true)}>Add another shift</button>
            </>
          )}
        </div>
      )}

      <p className="gate__note">
        Photo and PDF upload, and reading a posted schedule for you, come in the next update. For now shifts are entered by hand.
        Saved on this device only until shared saving is set up.
      </p>
    </main>
  );
}
