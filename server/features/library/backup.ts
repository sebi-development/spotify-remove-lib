import type { CategoryId } from "../../../shared/protocol.ts";
import { toUri, unwrap, type Category } from "./categories.ts";

export type BackupEntry = { uri: string; name: string; by?: string | undefined };

// "a, b, c" from Spotify's [{ name: 'a' }, { name: 'b' }, …] lists
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

// One Spotify item → one human-readable backup line. Same skip rule as the snapshot:
// no id → no URI → null, so the backup lists exactly what a wipe would delete.
export function toBackupEntry(category: Category, item: unknown): BackupEntry | null {
  const uri = toUri(category, item);
  if (!uri) return null;

  const obj = unwrap(category, item);
  return { uri, name: obj.name ?? '', by: BY[category.id]?.(obj) };
}

export async function 
