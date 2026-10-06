export interface NoticeState {
  kind: 'saved' | 'error';
  text: string;
}

/** Confirmation after a successful write, or the reason a write failed. */
export function Notice({ notice, onDismiss }: { notice: NoticeState | null; onDismiss: () => void }) {
  if (!notice) return null;
  const error = notice.kind === 'error';
  return (
    <div className="notice" data-kind={notice.kind} role={error ? 'alert' : 'status'}>
      <span>{notice.text}</span>
      <button type="button" className="notice__close" onClick={onDismiss}>Dismiss</button>
    </div>
  );
}
