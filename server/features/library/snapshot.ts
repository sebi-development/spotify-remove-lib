import { toUri } from './categories.ts';
import type { Category } from './categories.ts';
import { iterateCategory } from './iterate.ts';

// Items without an id (local files, tracks no longer available) have no URI and are skipped.
function pageToUris(category: Category, items: unknown[]): string[] {
  return items
    .map((item) => toUri(category, item))
    .filter((uri): uri is string => uri !== null);
}

// Reads the WHOLE category before anything is deleted, so deletes can't shift
export async function snapshotCategory(getToken: () => Promise<string>, category: Category): Promise<string[]> {
  const uris: string[] = [];
  for await (const items of iterateCategory(getToken, category)) {
    uris.push(...pageToUris(category, items));
  }
  return uris;
}
