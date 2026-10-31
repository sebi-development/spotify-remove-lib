import { CATEGORY_LABELS, type CategoryId } from '../../../shared/protocol.ts';

type Props = {
  accountName: string;
  items: { id: CategoryId; count: number }[];
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ accountName, items, onConfirm, onCancel }: Props) {
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <dialog
      // Open on mount. No close() on unmount: removing the element closes it, while close() would
      // fire 'close' → onCancel, which in StrictMode's mount-unmount-mount check hides the dialog at once.
      ref={(el) => {
        if (el && !el.open) el.showModal();
      }}
      onClose={onCancel}
      className="m-auto w-full max-w-md rounded-lg border border-line bg-surface-raised p-6 text-ink shadow-lg backdrop:bg-ink/40"
    >
      <h2 className="text-lg font-semibold">Remove from {accountName}?</h2>

      <ul className="mt-4 divide-y divide-line rounded border border-line">
        {items.map(({ id, count }) => (
          <li key={id} className="flex justify-between px-3 py-2 text-sm">
            <span>{CATEGORY_LABELS[id]}</span>
            <span className="text-ink-muted">{count}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm text-danger">This cannot be undone.</p>

      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="rounded border border-line px-4 py-2 hover:border-ink-muted"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="rounded bg-danger px-4 py-2 font-medium text-white hover:opacity-90"
        >
          Remove {total} items
        </button>
      </div>
    </dialog>
  );
}
