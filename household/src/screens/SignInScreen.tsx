import { useState } from 'react';
import type { AuthService } from '../auth/auth';
import { Field } from '../components/Field';
import { useSubmit } from '../hooks/useSubmit';

/** Account mode. Only invited household e-mail addresses can sign in; nobody picks who they are. */
export function SignInScreen({ auth, onSignedIn }: { auth: AuthService; onSignedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useSubmit();

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return setError('Enter your e-mail address.');
    setError(null);
    void run(async () => {
      try {
        await auth.requestSignIn?.(email);
        setSent(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Couldn’t send the e-mail.');
      }
    });
  }

  function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return setError('Enter the 6-digit code from the e-mail.');
    setError(null);
    void run(async () => {
      try {
        await auth.verifyCode?.(email, code);
        onSignedIn();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'That code didn’t work.');
      }
    });
  }

  return (
    <main className="gate" id="main">
      <p className="masthead__eyebrow">The Cottage</p>
      <h1 className="gate__heading">Sign in.</h1>
      <p className="gate__lead">
        Only invited household members can sign in. You’ll be signed in as the person your e-mail address was invited as; there is nothing to pick.
      </p>

      {!sent ? (
        <form className="form" onSubmit={send} noValidate>
          <Field label="Your e-mail address">
            <input className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error && <p className="form__error" role="alert">{error}</p>}
          <div className="form__actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
          </div>
        </form>
      ) : (
        <form className="form" onSubmit={verify} noValidate>
          <p className="gate__note" role="status">
            If <strong>{email.trim()}</strong> is invited, a sign-in link and a 6-digit code are on their way. Open the link on this device, or type the code here.
          </p>
          <Field label="6-digit code">
            <input className="input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          {error && <p className="form__error" role="alert">{error}</p>}
          <div className="form__actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
            <button type="button" className="link-btn" onClick={() => { setSent(false); setCode(''); setError(null); }}>Use a different address</button>
          </div>
        </form>
      )}
    </main>
  );
}
