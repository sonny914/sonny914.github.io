import { useState } from 'react';
import { ScheduleUpload } from '../components/ScheduleUpload';
import { ShiftForm } from '../components/ShiftForm';
import type { HouseholdMember, WorkEntry } from '../data/types';
import { Field } from '../components/Field';
import { shiftToEntry } from '../lib/records';
import { describeWorkEntry } from '../lib/schedules';
import type { ScheduleReader } from '../lib/scheduleUpload';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Step two of first-time setup, right after "Who are you?". */
export function ScheduleOnboardingScreen({
  me,
  entries,
  now,
  onSave,
  onFinish,
  onSkip,
  where,
  askBirthday,
  onSaveBirthday,
  readSchedule,
}: {
  me: HouseholdMember;
  entries: WorkEntry[];
  now: Date;
  onSave: (entry: WorkEntry) => Promise<boolean>;
  onFinish: () => Promise<boolean>;
  onSkip: () => Promise<boolean>;
  /** Where saved shifts live, in plain words (demo: this device only; shared: with the other adults). */
  where: string;
  /** True when the household doesn't know this adult's birthday yet. */
  askBirthday: boolean;
  onSaveBirthday: (month: number, day: number) => Promise<boolean>;
  /** Reads a PDF or photo of a schedule. Absent in the demo. */
  readSchedule?: ScheduleReader;
}) {
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [bdayError, setBdayError] = useState<string | null>(null);
  const [bdayBusy, setBdayBusy] = useState(false);
  const [savedBirthday, setSavedBirthday] = useState<string | null>(null);
  const mine = entries.filter((e) => e.memberId === me.id);

  async function saveBirthday() {
    const m = Number(month);
    const d = Number(day);
    if (!m || !d) return setBdayError('Choose a month and a day.');
    if (d > DAYS_IN_MONTH[m - 1]!) return setBdayError(`${MONTHS[m - 1]} has at most ${DAYS_IN_MONTH[m - 1]} days.`);
    setBdayError(null);
    setBdayBusy(true);
    try {
      if (await onSaveBirthday(m, d)) setSavedBirthday(`${MONTHS[m - 1]} ${d}`);
    } finally {
      setBdayBusy(false);
    }
  }

  return (
    <main className="gate" id="main">
      <p className="masthead__eyebrow">Welcome, {me.name}</p>
      <h1 className="gate__heading">Add your work schedule.</h1>
      <p className="gate__lead">
        Your shifts show on the day board and tell the household when you can and can’t cover a pickup. You can change them any time from Household.
      </p>

      {askBirthday ? (
        <section className="birthday-ask" aria-labelledby="bday-h">
          <h2 id="bday-h" className="birthday-ask__title">When is your birthday?</h2>
          <p className="birthday-ask__lead">The household sees it on the day board. Month and day only. You can skip this.</p>
          <div className="birthday-ask__row">
            <Field label="Birthday month">
              <select className="input" value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="">Month</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Birthday day">
              <select className="input" value={day} onChange={(e) => setDay(e.target.value)}>
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </Field>
          </div>
          {bdayError && <p className="form__error" role="alert">{bdayError}</p>}
          <button type="button" className="btn btn-quiet" disabled={bdayBusy} onClick={() => void saveBirthday()}>{bdayBusy ? 'Saving…' : 'Save birthday'}</button>
        </section>
      ) : (
        savedBirthday && <p className="gate__note" role="status">Birthday saved: {savedBirthday}.</p>
      )}

      {mine.length > 0 && (
        <ul className="gate__saved" aria-label="Shifts you added">
          {mine.map((e) => (
            <li key={e.id}>{describeWorkEntry(e)}</li>
          ))}
        </ul>
      )}

      {uploading && readSchedule ? (
        <ScheduleUpload
          reader={readSchedule}
          memberName={me.name}
          existing={mine}
          now={now}
          onSave={(i) => onSave(shiftToEntry(i, me.id, me.id, new Date()))}
          onDone={() => setUploading(false)}
        />
      ) : adding ? (
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
              {readSchedule && <button type="button" className="btn btn-primary" onClick={() => setUploading(true)}>Upload a schedule</button>}
              <button type="button" className={readSchedule ? 'btn btn-quiet' : 'btn btn-primary'} onClick={() => setAdding(true)}>Add my shifts</button>
              <button type="button" className="btn btn-quiet" onClick={() => void onSkip()}>Skip for now</button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-primary" onClick={() => void onFinish()}>Done</button>
              <button type="button" className="btn btn-quiet" onClick={() => setAdding(true)}>Add another shift</button>
              {readSchedule && <button type="button" className="btn btn-quiet" onClick={() => setUploading(true)}>Upload a schedule</button>}
            </>
          )}
        </div>
      )}

      <p className="gate__note">
        {readSchedule
          ? 'Upload a PDF, screenshot or photo and check the shifts before they save, or enter them by hand. '
          : 'Photo and PDF upload, and reading a posted schedule for you, come in the next update. For now shifts are entered by hand. '}
        {where}
      </p>
    </main>
  );
}
