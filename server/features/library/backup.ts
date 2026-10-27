import type { CategoryId } from "../../../shared/protocol.ts";
import { toUri, unwrap, type Category } from "./categories.ts";
import { iterateCategory } from "./iterate.ts";

export type BackupEntry = { uri: string; name: string; by?: string | undefined };

const joinNames = (list: { name: string }[] | undefined) => list?.map((x) => x.name).join(', ');

// Where each category keeps its "who made this". Missing = nothing to show (artists).
const BY: Partial<Record<CategoryId, (obj: any) => string | undefined>> = {
  tracks: (obj) => joinNames(obj.artists),
  albums: (obj) => joinNames(obj.artists),
  shows: (obj) => obj.publisher,
  episodes: (obj) => obj.show?.name,
  audiobooks: (obj) => joinNames(obj.authors),
  playlists: (obj) => obj.owner?.display_name,
};

export function toBackupEntry(category: Category, item: unknown): BackupEntry | null {
  const uri = toUri(category, item);
  if (!uri) return null;

  const obj = unwrap(category, item);
  return { uri, name: obj.name ?? '', by: BY[category.id]?.(obj) };
}

function pageToEntries(category: Category, items: unknown[]): BackupEntry[] {
  return items
    .map((item) => toBackupEntry(category, item))
    .filter((entry): entry is BackupEntry => entry !== null);
}

// The backup file as a stream of JSON text pieces; joined together they are one valid JSON document.
// Reads one page at a time, so memory stays flat however big the library is.
export async function* backupChunks(getToken: () => Promise<string>, categories: Category[]): AsyncGenerator<string> {
  yield `{"exportedAt":${JSON.stringify(new Date().toISOString())},"categories":{`;

  for (const [index, category] of categories.entries()) {
    // Every category is written (even empty), so its position decides the comma.
    yield `${index > 0 ? ',' : ''}${JSON.stringify(category.id)}:[`;

    let first = true;
    for await (const items of iterateCategory(getToken, category)) {
      const entries = pageToEntries(category, items);
      if (entries.length === 0) continue; // nothing to write → no comma either
      yield (first ? '' : ',') + entries.map((entry) => JSON.stringify(entry)).join(',');
      first = false;
    }

    yield ']';
  }

  yield '}}';
}
