import { CATEGORY_IDS, CATEGORY_LABELS, type CategoryId } from "../../../shared/protocol";
type Props = {
  counts: Record<CategoryId, number>;
  selected: Set<CategoryId>;
  onToggle: (id: CategoryId) => void;
};

export function CategoryChecklist({ counts, selected, onToggle }: Props) {
  return (
    <ul>
      {CATEGORY_IDS.map((id) => (
        <li key={id}>
          <label>
            <input
              type="checkbox"
              checked={selected.has(id)}
              disabled={counts[id] === 0}
              onChange={() => onToggle(id)}
            />
            {CATEGORY_LABELS[id]} ({counts[id]})
          </label>
        </li>
      ))}
    </ul>
  )
}