export function LoadingScreen({ label = 'Loading the household…' }: { label?: string }) {
  return (
    <main className="gate" id="main" aria-busy="true">
      <p className="masthead__eyebrow">The Cottage</p>
      <p className="gate__lead" role="status">{label}</p>
    </main>
  );
}

export function ErrorScreen({ title, message, onRetry, onSignOut }: { title: string; message: string; onRetry?: () => void; onSignOut?: () => void }) {
  return (
    <main className="gate" id="main">
      <p className="masthead__eyebrow">The Cottage</p>
      <h1 className="gate__heading">{title}</h1>
      <p className="form__error" role="alert">{message}</p>
      <div className="form__actions">
        {onRetry && <button type="button" className="btn btn-primary" onClick={onRetry}>Try again</button>}
        {onSignOut && <button type="button" className="btn btn-quiet" onClick={onSignOut}>Sign out</button>}
      </div>
    </main>
  );
}

/** Signed in, but the account is not linked to any household member, so it can see and change nothing. */
export function UnlinkedScreen({ email, onSignOut }: { email?: string; onSignOut: () => void }) {
  return (
    <main className="gate" id="main">
      <p className="masthead__eyebrow">The Cottage</p>
      <h1 className="gate__heading">This account isn’t set up.</h1>
      <p className="gate__lead">
        You’re signed in{email ? <> as <strong>{email}</strong></> : ''}, but this address isn’t linked to a household member, so The Cottage can’t show you anything.
        Ask whoever set up The Cottage to invite this address.
      </p>
      <div className="form__actions">
        <button type="button" className="btn btn-quiet" onClick={onSignOut}>Sign out</button>
      </div>
    </main>
  );
}
