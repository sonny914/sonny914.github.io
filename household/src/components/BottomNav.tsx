import type { ReactNode } from 'react';
import { CalendarIcon, CoverageIcon, HomeIcon, HouseholdIcon } from './Icons';

export type TabId = 'home' | 'calendar' | 'coverage' | 'household';

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: 'home', label: 'Home', icon: <HomeIcon /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarIcon /> },
  { id: 'coverage', label: 'Coverage', icon: <CoverageIcon /> },
  { id: 'household', label: 'Household', icon: <HouseholdIcon /> },
];

export function BottomNav({ tab, onChange }: { tab: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      <ul>
        {TABS.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              className="nav-btn"
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => onChange(t.id)}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
