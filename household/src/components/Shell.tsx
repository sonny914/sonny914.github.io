import type { ReactNode } from 'react';
import type { HouseholdMember, MemberId } from '../data/types';
import { BottomNav, type TabId } from './BottomNav';
import { ChevronDownIcon, PlusIcon } from './Icons';

export interface Chrome {
  tab: TabId;
  onTab: (t: TabId) => void;
  onAdd: () => void;
  adults: HouseholdMember[];
  viewingAs: MemberId;
  onViewingAs: (id: MemberId) => void;
  attentionCount: number;
}

/** Masthead, navigation and the main landmark shared by every screen. */
export function Shell({
  chrome,
  eyebrow,
  heading,
  summary,
  children,
}: {
  chrome: Chrome;
  eyebrow: string;
  heading: string;
  summary?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="masthead">
        <div className="masthead__inner">
          <div className="masthead__top">
            <p className="masthead__eyebrow">{eyebrow}</p>
            <div className="masthead__tools">
              <label className="viewing-as">
                <span className="viewing-as__label">Viewing as</span>
                <select value={chrome.viewingAs} onChange={(e) => chrome.onViewingAs(e.target.value)}>
                  {chrome.adults.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <ChevronDownIcon size={16} className="viewing-as__chevron" />
              </label>
              <button type="button" className="btn btn-add-desktop" onClick={chrome.onAdd} aria-haspopup="dialog">
                <PlusIcon size={18} /> Add
              </button>
            </div>
          </div>
          <h1 className="masthead__heading">{heading}</h1>
          {summary && <div className="masthead__summary">{summary}</div>}
        </div>
      </header>
      <BottomNav tab={chrome.tab} onChange={chrome.onTab} onAdd={chrome.onAdd} attentionCount={chrome.attentionCount} />
      <main className="main" id="main">{children}</main>
    </div>
  );
}
