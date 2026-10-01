import { useEffect, useRef, useState } from 'react';
import { CalendarIcon, ClockIcon, CloseIcon, CoverageIcon, ListIcon, PlusIcon } from './Icons';

const OPTIONS = [
  { id: 'event', label: 'Event', hint: 'Something on the family calendar', Icon: CalendarIcon },
  { id: 'work', label: 'Work schedule', hint: 'Upload or enter a shift schedule', Icon: ClockIcon },
  { id: 'appointment', label: 'Appointment', hint: 'Doctor, dentist, therapy, school meeting', Icon: ListIcon },
  { id: 'coverage', label: 'Coverage need', hint: 'A pickup, drop-off or care gap', Icon: CoverageIcon },
  { id: 'reminder', label: 'Reminder', hint: 'A one-time or repeating reminder', Icon: PlusIcon },
] as const;

/** Mounted only while open, so its state resets every time without an effect. */
export function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <SheetBody onClose={onClose} /> : null;
}

function SheetBody({ onClose }: { onClose: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key !== 'Tab' || !sheetRef.current) return;
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
  }, [onClose]);

  const pickedLabel = OPTIONS.find((o) => o.id === picked)?.label;

  return (
    <div
      className="sheet-backdrop"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div ref={sheetRef} className="sheet" role="dialog" aria-modal="true" aria-labelledby="add-h">
        <div className="sheet__head">
          <h2 id="add-h">Add to the board</h2>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
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
            ? `Demo only: the “${pickedLabel}” form arrives in a later slice. Nothing was saved.`
            : 'A preview of the Add menu. The forms arrive in later slices.'}
        </p>
      </div>
    </div>
  );
}
