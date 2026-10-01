import { EmptyState } from '../components/EmptyState';

export function PlaceholderScreen({
  title,
  intro,
  coming,
}: {
  title: string;
  intro: string;
  coming: string[];
}) {
  return (
    <main className="screen" id="main">
      <header className="screen-head">
        <h1 className="screen-title">{title}</h1>
        <p className="screen-sub">{intro}</p>
      </header>
      <section className="section">
        <EmptyState title="Coming in a later slice">
          This screen is a placeholder so you can see where it will live.
        </EmptyState>
        <h2 className="section-title section-title-small">What will be here</h2>
        <ul className="plain-list">
          {coming.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
