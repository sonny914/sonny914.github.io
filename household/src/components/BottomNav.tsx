import type { ReactNode } from 'react';
import { CalendarIcon, CoverageIcon, HomeIcon, HouseholdIcon, PlusIcon } from './Icons';

export type TabId = 'home' | 'calendar' | 'coverage' | 'household';

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: 'home', label: 'Home', icon: <HomeIcon /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarIcon /> },
  { id: 'coverage', label: 'Coverage', icon: <CoverageIcon /> },
  { id: 'household', label: 'Household', icon: <HouseholdIcon /> },
];

/**
 * Phone: fixed bar with Add as a raised centre button, so it never covers content.
 * Desktop: the same list becomes tabs under the masthead (Add moves to the masthead).
 */
export function BottomNav({
  tab,
  onChange,
  onAdd,
  attentionCount,
}: {
  tab: TabId;
  onChange: (t: TabId) => void;
  onAdd: () => void;
  attentionCount: number;
}) {
  const item = (t: (typeof TABS)[number]) => (
    <li key={t.id} className="nav__item" data-tab={t.id}>
      <button
        type="button"
        className="nav__btn"
        aria-current={tab === t.id ? 'page' : undefined}
        aria-label={t.id === 'home' && attentionCount > 0 ? `Home, ${attentionCount} need attention` : undefined}
        onClick={() => onChange(t.id)}
      >
        <span className="nav__icon">
          {t.icon}
          {t.id === 'home' && attentionCount > 0 && <span className="nav__dot" aria-hidden="true" />}
        </span>
        <span className="nav__label">{t.label}</span>
      </button>
    </li>
  );
  return (
    <nav className="nav" aria-label="Main">
      <ul>
        {TABS.slice(0, 2).map(item)}
        <li className="nav__item nav__item--add">
          <button type="button" className="nav__add" onClick={onAdd} aria-haspopup="dialog">
            <PlusIcon size={26} />
            <span className="visually-hidden">Add</span>
          </button>
        </li>
        {TABS.slice(2).map(item)}
      </ul>
    </nav>
  );
}
