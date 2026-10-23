import { api, withQuery } from '../../lib/spotify.ts';
import type { Category } from './categories.ts';

const PAGE_SIZE = 50;

type GetToken = () => Promise<string>;
type OffsetPage = { items: unknown[]; total: number };
type CursorPage = { artists: { items: unknown[]; cursors: { after: string | null } | null } };

export async function* iterateCategory(getToken: GetToken, category: Category): AsyncGenerator<unknown[]> {
  yield* category.paging === 'cursor'
    ? iterateByCursor(getToken, category)
    : iterateByOffset(getToken, category);
}

// /me/tracks, /me/albums, …: ?limit=&offset=, and every response carries `total`.
async function* iterateByOffset(getToken: GetToken, category: Category): AsyncGenerator<unknown[]> {
  let offset = 0;
  let total = 0;
  do {
    const page = await api(getToken, withQuery(category.endpoint, { limit: PAGE_SIZE, offset })) as OffsetPage;
    total = page.total;
    yield page.items;
    offset += PAGE_SIZE;
  } while (offset < total);
}

// /me/following?type=artist: no offsets; each response says where the next page starts.
async function* iterateByCursor(getToken: GetToken, category: Category): AsyncGenerator<unknown[]> {
  let after: string | null = null; // no cursor yet = start from the beginning
  do {
    const params = after === null ? { limit: PAGE_SIZE } : { limit: PAGE_SIZE, after };
    const page = await api(getToken, withQuery(category.endpoint, params)) as CursorPage;
    yield page.artists.items;

    const next = page.artists.cursors?.after ?? null;
    if (next !== null && next === after) throw new Error(`Cursor did not advance for ${category.id}`);
    after = next;
  } while (after !== null);
}
