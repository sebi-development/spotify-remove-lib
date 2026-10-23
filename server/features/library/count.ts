import { api, withQuery } from "../../lib/spotify.ts";
import type { Category } from "./categories.ts";

type OffsetCount = { total: number };
type CursorCount = { artists: { total: number } };

export async function countCategory(
  getToken: () => Promise<string>,
  category: Category,
): Promise<number> {
  const url = withQuery(category.endpoint, { limit: 1 });

  if (category.paging === 'cursor') {
    const res = await api(getToken, url) as CursorCount;
    return res.artists.total;
  }

  const res = await api(getToken, url) as OffsetCount;
  return res.total;
}
