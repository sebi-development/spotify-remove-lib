import { CATEGORY_LABELS, type JobState } from '../../../shared/protocol.ts';
import { percentOf } from '../utils/progress.ts';

type Props = {
  job: JobState | null;
  onCancel: () => void;
};

function statusText(job: JobState): string {
  switch (job.status) {
    case 'running': return job.dryRun ? 'Previewing…' : 'Removing…';
    case 'done': return job.dryRun ? 'Preview finished. Nothing was deleted.' : 'Finished.';
    case 'cancelled': return 'Cancelled. Items already removed stay removed.';
    case 'error': return job.error ?? 'Something went wrong.';
  }
}

export function ProgressList({ job, onCancel }: Props) {
  if (!job) return null;

  return (
    <section className="space-y-4 rounded-lg border border-line bg-surface-raised p-4">
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium">{job.dryRun ? 'Preview' : 'Removal'}</h2>
        {job.status === 'running' && (
          <button
            onClick={onCancel}
            className="rounded border border-line px-3 py-1.5 text-sm hover:border-ink-muted"
          >
            Cancel
          </button>
        )}
      </header>

      <p role="status" className={job.status === 'error' ? 'text-danger' : 'text-ink-muted'}>
        {statusText(job)}
      </p>

      <ul className="space-y-3">
        {job.categories.map((id) => {
          const entry = job.progress[id];
          return (
            <li key={id}>
              <div className="flex justify-between text-sm">
                <span>{CATEGORY_LABELS[id]}</span>
                <span className="text-ink-muted">
                  {entry
                    ? `${entry.removed} / ${entry.total}${entry.done ? ' ✔' : ''}`
                    : job.status === 'running' ? 'Waiting' : 'Not started'}
                </span>
              </div>
              <progress
                className="h-2 w-full accent-accent"
                value={entry ? percentOf(entry.removed, entry.total) : 0}
                max={100}
              />
            </li>
          );
        })}
      </ul>

      {job.summary && (
        <footer className="border-t border-line pt-3 text-sm">
          <p className="font-medium">{job.dryRun ? 'Would remove' : 'Removed'}</p>
          <ul className="text-ink-muted">
            {job.categories.map((id) => (
              <li key={id}>
                {CATEGORY_LABELS[id]}: {job.summary?.removed[id] ?? 0}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-ink-muted">Took {job.summary.seconds.toFixed(1)} s</p>
        </footer>
      )}
    </section>
  );
}
