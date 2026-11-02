import { CATEGORIES, type Category } from './categories.ts';
import { snapshotCategory } from './snapshot.ts';
import { deleteUris } from './remover.ts';
import type { CategoryId, CleanupEvent, CleanupSummary } from '../../../shared/protocol.ts';
import { countCategory } from './count.ts';

export type CleanupOptions = {
  categories: CategoryId[];
  dryRun: boolean; // required: no default for a destructive action
  signal?: AbortSignal | undefined;
  onEvent?: ((event: CleanupEvent) => void) | undefined;
};

async function recount(getToken: () => Promise<string>, categories: Category[]): Promise<CleanupSummary['remaining']> {
  try {
    const pairs = await Promise.all(categories.map(async (c) => [c.id, await countCategory(getToken, c)] as const))
    return Object.fromEntries(pairs);
  } catch {
    return undefined;
  }
}

export async function runCleanup(getToken: () => Promise<string>, options: CleanupOptions): Promise<CleanupSummary> {
  const { categories, dryRun, signal, onEvent } = options;
  const start = Date.now();
  const removed: CleanupSummary['removed'] = {};

  const selected = CATEGORIES.filter((c) => categories.includes(c.id))

  for (const category of selected) {
    if (signal?.aborted) break
    const uris = await snapshotCategory(getToken, category)
    onEvent?.({ type: 'category_started', category: category.id, total: uris.length })

    removed[category.id] = await deleteUris(getToken, uris, {
      dryRun, signal,
      onProgress: (p) => onEvent?.({ type: 'progress', category: category.id, ...p }),
    })
    onEvent?.({ type: 'category_done', category: category.id, removed: removed[category.id] ?? 0 })
  }
  const touched = selected.filter((c) => removed[c.id] !== undefined)
  const remaining = dryRun ? undefined : await recount(getToken, touched);

  return { removed, remaining, cancelled: signal?.aborted ?? false, seconds: (Date.now() - start) / 1000 };
}