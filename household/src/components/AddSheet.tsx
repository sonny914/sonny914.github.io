import { useEffect, useRef, useState } from 'react';
import { CalendarIcon, CloseIcon, CoverageIcon, ListIcon, PlusIcon, ClockIcon } from './Icons';

const OPTIONS = [
  { id: 'event', label: 'Event', hint: 'Something on the family calendar', Icon: CalendarIcon },
  { id: 'work', label: 'Work schedule', hint: 'Upload or enter a shift schedule', Icon: ClockIcon },
  { id: 'appointment', label: 'Appointment', hint: 'Doctor, dentist, therapy, school meeting', Icon: ListIcon },
  { id: 'coverage', label: 'Coverage need', hint: 'A pickup, drop-off or care gap', Icon: CoverageIcon },
  { id: 'reminder', label: 'Reminder', hint: 'A one-time or repeating reminder', Icon: PlusIcon },
] as const;

export function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key !== 'Tab' || !sheetRef.current) return;
      // Keep focus inside the sheet while it is open.
      const items = sheetRef.current.querySelectorAll<HTMLElement>('button');
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  const pickedLabel = OPTIONS.find((o) => o.id === picked)?.label;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-h"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <h2 id="add-h">What would you like to add?</h2>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <ul className="sheet-list">
          {OPTIONS.map(({ id, label, hint, Icon }) => (
            <li key={id}>
              <button type="button" className="sheet-option" aria-pressed={picked === id} onClick={() => setPicked(id)}>
                <span className="sheet-option-icon"><Icon size={22} /></span>
                <span>
                  <span className="sheet-option-label">{label}</span>
                  <span className="sheet-option-hint">{hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="sheet-note" role="status">
          {pickedLabel
            ? `Demo only: the “${pickedLabel}” form arrives in a later slice. Nothing was saved.`
            : 'This is a preview of the Add menu. Forms arrive in later slices.'}
        </p>
      </div>
    </div>
  );
}
