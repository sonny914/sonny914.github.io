import { pickupReminder, pickupReminderText } from '../lib/routines';

/** The evening-before prompt for trash and recycling. Informational, so it uses no attention colour. */
export function PickupReminder({ now }: { now: Date }) {
  const r = pickupReminder(now);
  if (!r) return null;
  const { title, detail } = pickupReminderText(r);
  return (
    <section className="pickup" aria-label="Trash and recycling">
      <h2 className="pickup__title">{title}</h2>
      <p className="pickup__detail">{detail}</p>
    </section>
  );
}
