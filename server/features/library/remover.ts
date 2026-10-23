import { api, sleep } from '../../lib/spotify.ts';

type DeleteOptions = {
  signal?: AbortSignal | undefined;
  dryRun: boolean; // required: no default for a destructive action
  onProgress?: ((p: { removed: number; total: number }) => void) | undefined;
};

const SIZE_CHUNK = 40

function chunk<T>(items: T[], size: number): T[][] {
  return Array.from(
    { length: Math.ceil(items.length / size) },
    (_, i) => items.slice(i * size, i * size + size),
  );
}

export async function deleteUris(getToken: () => Promise<string>, uris: string[], options: DeleteOptions): Promise<number> {
  const { signal, dryRun, onProgress } = options;
  let removed = 0
  for (const batch of chunk(uris, SIZE_CHUNK)) {
    if (signal?.aborted) break;
    if (!dryRun) {
      await api(getToken, `/me/library?uris=${batch.map(encodeURIComponent).join(',')}`, 'DELETE');
    }
    removed += batch.length
    onProgress?.({ removed, total: uris.length })

    await sleep(150)
  }
  return removed
}