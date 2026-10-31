import { useState } from 'react';
import type { CategoryId, JobState } from '../../../shared/protocol.ts';

type Props = {
  selected: Set<CategoryId>;
  connected: boolean;
  job: JobState | null;
  onStart: (dryRun: boolean) => void;
};

export function RunControls({ selected, connected, job, onStart }: Props) {
  const [dryRun, setDryRun] = useState(true);

  const running = job?.status === 'running';
  const canStart = selected.size > 0 && connected && !running;

  return (
    <section className="space-y-3 rounded-lg border border-line bg-surface-raised p-4">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
        <span>
          Dry run <span className="text-ink-muted">(preview only, nothing is deleted)</span>
        </span>
      </label>

      <button
        disabled={!canStart}
        onClick={() => onStart(dryRun)}
        className={`rounded px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-40 ${dryRun ? 'bg-accent text-ink hover:bg-accent-light' : 'bg-danger text-white hover:opacity-90'
          }`}
      >
        {running ? 'Running…' : dryRun ? 'Preview removal' : 'Remove from my library'}
      </button>
    </section>
  );
}
