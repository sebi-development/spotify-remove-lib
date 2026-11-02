import { CATEGORY_IDS, CATEGORY_LABELS, type CategoryId } from "../../../shared/protocol.ts";

type Props = {
  counts: Record<CategoryId, number>;
  selected: Set<CategoryId>;
  onToggle: (id: CategoryId) => void;
};

export function CategoryChecklist({ counts, selected, onToggle }: Props) {
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {CATEGORY_IDS.map((id) => (
          <li key={id}>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-accent"
                checked={selected.has(id)}
                disabled={counts[id] === 0}
                onChange={() => onToggle(id)}
              />
              <span className={counts[id] === 0 ? "text-ink-muted/60" : "text-ink"}>
                {CATEGORY_LABELS[id]} ({counts[id]})
              </span>
            </label>
          </li>
        ))}
      </ul>
      {selected.has("playlists") && (
        <p className="rounded border border-line bg-surface p-2.5 text-xs text-ink-muted">
          <strong className="text-ink">Note:</strong> User-created and followed playlists only. Spotify-owned algorithmic or editorial playlists (like <em>Discover Weekly</em> or <em>Daylist</em>) cannot be removed due to Spotify API limits.
        </p>
      )}
    </div>
  );
}