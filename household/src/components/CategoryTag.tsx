import type { EventCategory } from '../data/types';
import { CATEGORY_LABELS } from '../data/members';

export function CategoryTag({ category }: { category: EventCategory }) {
  return (
    <span className="tag" data-category={category}>
      {CATEGORY_LABELS[category]}
    </span>
  );
}
