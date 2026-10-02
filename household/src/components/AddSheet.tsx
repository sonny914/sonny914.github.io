import { useState } from 'react';
import { Sheet } from './Sheet';
import { CalendarIcon, ClockIcon, CoverageIcon, ListIcon, PlusIcon } from './Icons';

const OPTIONS = [
  { id: 'event', label: 'Event', hint: 'Something on the family calendar', Icon: CalendarIcon },
  { id: 'work', label: 'Work schedule', hint: 'Upload or enter a shift schedule', Icon: ClockIcon },
  { id: 'appointment', label: 'Appointment', hint: 'Doctor, dentist, therapy, school meeting', Icon: ListIcon },
  { id: 'coverage', label: 'Coverage need', hint: 'A pickup, drop-off or care gap', Icon: CoverageIcon },
  { id: 'reminder', label: 'Reminder', hint: 'A one-time or repeating reminder', Icon: PlusIcon },
] as const;

export function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <SheetBody onClose={onClose} /> : null;
}

/** Mounted only while open, so its state resets every time. */
function SheetBody({ onClose }: { onClose: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const pickedLabel = OPTIONS.find((o) => o.id === picked)?.label;
  return (
    <Sheet title="Add to the board" onClose={onClose}>
      <ul className="sheet__list">
        {OPTIONS.map(({ id, label, hint, Icon }) => (
          <li key={id}>
            <button type="button" className="sheet__option" aria-pressed={picked === id} onClick={() => setPicked(id)}>
              <Icon size={22} />
              <span>
                <span className="sheet__label">{label}</span>
                <span className="sheet__hint">{hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="sheet__note" role="status">
        {pickedLabel
          ? `Demo only: the “${pickedLabel}” form arrives in a later slice. Nothing was saved. To add shifts or child updates now, use the Household tab.`
          : 'A preview of the Add menu. To add shifts or child updates now, use the Household tab.'}
      </p>
    </Sheet>
  );
}
