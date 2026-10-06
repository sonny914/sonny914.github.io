import { type Chrome, Shell } from '../components/Shell';

export function PlaceholderScreen({
  chrome,
  title,
  intro,
  coming,
}: {
  chrome: Chrome;
  title: string;
  intro: string;
  coming: string[];
}) {
  return (
    <Shell chrome={chrome} eyebrow="The Cottage" heading={title} summary={<p>{intro}</p>}>
      <section className="section placeholder">
        <h2 className="section__title">Coming in a later slice</h2>
        <p className="placeholder__intro">This screen is a placeholder so you can see where it will live.</p>
        <ul className="placeholder__list">
          {coming.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>
    </Shell>
  );
}
