import { useState } from 'react';
import type { CategoryId } from '../../../shared/protocol.ts';
import { CategoryChecklist } from './CategoryChecklist.tsx';
import { useCleanupSocket } from '../hooks/useCleanupSocket.ts';
import { useSummary } from '../hooks/useSummary.ts';

type DashboardProps = {
  user: { id: string; displayName: string };
  onLogout: () => void;
};

export function Dashboard({ user, onLogout }: DashboardProps) {
  // Lives here, not in App: the server only accepts the socket for a logged-in user,
  // and this component only exists once we are logged in.
  const { connected } = useCleanupSocket();
  const summary = useSummary()
  const [selected, setSelected] = useState<Set<CategoryId>>(new Set());

  const toggle = (id: CategoryId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id)
      }
      else {
        next.add(id)
      }
      return next;
    });
  };

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="flex items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-semibold">Spotify Library Cleaner</h1>
          <p className="text-sm text-ink-muted">
            Logged in as <strong>{user.displayName}</strong>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-ink-muted">
            <span className={`size-2 rounded-full ${connected ? 'bg-accent' : 'bg-ink-muted'}`} />
            {connected ? 'Live' : 'Offline'}
          </span>
          <button
            onClick={onLogout}
            className="rounded border border-line bg-surface-raised px-3 py-1.5 text-sm hover:border-ink-muted"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="rounded-lg border border-line bg-surface-raised p-4">
        <h2 className="mb-3 text-lg font-medium">What to remove</h2>
        {summary.status === 'loading' && <p className="text-ink-muted">Loading your library…</p>}
        {summary.status === 'error' && (
          <p role="alert" className="text-danger">
            Could not load your library. Reload the page to try again.
          </p>
        )}
        {summary.status === 'ready' && (
          <CategoryChecklist counts={summary.counts} selected={selected} onToggle={toggle} />
        )}
      </section>
    </main>
  );
}
