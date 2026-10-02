import type { AuthService } from '../auth/auth';
import { Avatar } from '../components/Avatar';
import type { HouseholdMember, MemberId } from '../data/types';

/** First screen for anyone not yet chosen on this device. */
export function WhoAreYouScreen({ adults, auth, onChoose }: { adults: HouseholdMember[]; auth: AuthService; onChoose: (id: MemberId) => void }) {
  return (
    <main className="gate" id="main">
      <p className="masthead__eyebrow">The Cottage</p>
      <h1 className="gate__heading">Who are you?</h1>
      <ul className="gate__list">
        {adults.map((a) => (
          <li key={a.id}>
            <button type="button" className="gate__option" onClick={() => onChoose(a.id)}>
              <Avatar member={a} size={40} />
              <span>{a.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {auth.kind === 'demo' && (
        <p className="gate__note">
          <strong>Demo mode.</strong> Choosing your name tells The Cottage who you are on this device. It is not a
          sign-in: there is no password, and nothing is shared with the other adults yet.
        </p>
      )}
    </main>
  );
}
