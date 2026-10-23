import { CATEGORIES } from './categories.ts';
import { snapshotCategory } from './snapshot.ts';
import { deleteUris } from './remover.ts';
import type { CategoryId, CleanupEvent, CleanupSummary } from '../../../shared/protocol.ts';

export type CleanupOptions = {
  categories: CategoryId[];
  dryRun: boolean; // required: no default for a destructive action
  signal?: AbortSignal | undefined;
  onEvent?: ((event: CleanupEvent) => void) | undefined;
};

export async function runCleanup(getToken: () => Promise<string>, options: CleanupOptions): Promise<CleanupSummary> {
  const { categories, dryRun, signal, onEvent } = options;
  const start = Date.now();
  const removed: CleanupSummary['removed'] = {};

  const selected = CATEGORIES.filter((c) => categories.includes(c.id))

  for (const category of selected) {

    if(signal?.aborted) break
    const uris = await snapshotCategory(getToken, category)
    onEvent?.({type: 'category_started', category: category.id, total: uris.length})

    removed[category.id] = await deleteUris(getToken, uris, {
         dryRun, signal,
         onProgress: (p) => onEvent?.({ type: 'progress', category: category.id, ...p }),
       })
    onEvent?.({type: 'category_done', category: category.id, removed: removed[category.id] ?? 0})
  }

  return { removed, cancelled: signal?.aborted ?? false, seconds: (Date.now() - start) / 1000 };
}