import type { ReactNode } from 'react';

export function EmptyState({ title, children, tone = 'neutral' }: { title: string; children?: ReactNode; tone?: 'neutral' | 'good' }) {
  return (
    <div className="empty" data-tone={tone}>
      <p className="empty__title">{title}</p>
      {children && <p className="empty__body">{children}</p>}
    </div>
  );
}
