import { CATEGORY_IDS, CATEGORY_LABELS, type CategoryId } from "../../../shared/protocol";
import { useSummary } from "../hooks/useSummary";

type Props = {
  counts: Record<CategoryId, number>;
  selected: Set<CategoryId>;
  onToggle: (id: CategoryId) => void;
};

export function CategoryChecklist({ counts, selected, onToggle }: Props) {
  const summary = useSummary()

  return (
    <ul>
      {CATEGORY_IDS.map((id) => (
        <li key={id}>
          <label>
            <input
              type="checkbox"
              checked={CATEGORY_IDS}                      // is this id in the selected set?
              disabled={___}                     // nothing to delete: counts[id] is 0
              onChange={() => ___}               // tell the parent which id was toggled
            />
            {CATEGORY_LABELS[id]} ({counts[id]})
          </label>
        </li>
      ))}
    </ul>
  )
}