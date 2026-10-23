import { afterEach, describe, expect, it, vi } from 'vitest';
import { iterateCategory } from './iterate.ts';
import { CATEGORIES } from './categories.ts';
import { stubCursorSpotify, stubOffsetSpotify, stubSpotifyResponse } from '../../test/fakeSpotify.ts';

const tracks = CATEGORIES.find((c) => c.id === 'tracks')!;
const artists = CATEGORIES.find((c) => c.id === 'artists')!;
const getToken = async () => 'fake-token';

async function collect(category = tracks): Promise<unknown[][]> {
  const pages: unknown[][] = [];
  for await (const items of iterateCategory(getToken, category)) pages.push(items);
  return pages;
}

const idsOf = (pages: unknown[][]) => pages.flat().map((item) => (item as { id: number }).id);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

afterEach(() => vi.unstubAllGlobals());

describe('iterateCategory (offset paging)', () => {
  // [library size, expected pages]: the boundaries around PAGE_SIZE = 50 are where do…while bugs hide
  it.each([
    [0, 1],
    [1, 1],
    [49, 1],
    [50, 1],
    [51, 2],
    [100, 2],
    [101, 3],
    [130, 3],
  ])('library of %i items -> %i page(s), every item exactly once', async (total, expectedPages) => {
    const offsets = stubOffsetSpotify(total);
    const pages = await collect();

    expect(pages).toHaveLength(expectedPages);
    expect(offsets).toHaveLength(expectedPages); // no wasted extra request
    expect(idsOf(pages)).toEqual(range(total)); // complete, in order, no duplicates
  });

  it('requests pages at increasing offsets of 50', async () => {
    const offsets = stubOffsetSpotify(130);
    await collect();
    expect(offsets).toEqual([0, 50, 100]);
  });

  it('is lazy: stopping early fetches no further pages', async () => {
    const offsets = stubOffsetSpotify(130);
    for await (const _page of iterateCategory(getToken, tracks)) break; // consumer walks away after page 1
    expect(offsets).toEqual([0]);
  });

  it('does not run until the consumer asks', () => {
    const offsets = stubOffsetSpotify(130);
    iterateCategory(getToken, tracks); // created, never iterated
    expect(offsets).toEqual([]);
  });

  it('propagates an API failure to the consumer', async () => {
    stubSpotifyResponse({ error: { status: 401 } }, 401);
    await expect(collect()).rejects.toThrow(/API Error \[401\]/);
  });
});

describe('iterateCategory (cursor paging)', () => {
  it.each([
    [0, 1],
    [1, 1],
    [50, 1],
    [51, 2],
    [120, 3],
  ])('%i artists -> %i page(s), every artist exactly once', async (total, expectedPages) => {
    const afters = stubCursorSpotify(total);
    const pages = await collect(artists);

    expect(pages).toHaveLength(expectedPages);
    expect(afters).toHaveLength(expectedPages);
    expect(idsOf(pages)).toEqual(range(total));
  });

  it("sends no cursor on the first request, then the previous page's cursor", async () => {
    const afters = stubCursorSpotify(120);
    await collect(artists);
    expect(afters).toEqual([null, '49', '99']);
  });

  it('is lazy: stopping early fetches no further pages', async () => {
    const afters = stubCursorSpotify(120);
    for await (const _page of iterateCategory(getToken, artists)) break;
    expect(afters).toEqual([null]);
  });

  it('throws instead of looping forever when the cursor does not advance', async () => {
    stubSpotifyResponse({ artists: { items: [{ id: 'x' }], total: 99, cursors: { after: 'stuck' } } });
    await expect(collect(artists)).rejects.toThrow(/did not advance/);
  });

  it('treats missing cursors (null) as the end of the list', async () => {
    stubSpotifyResponse({ artists: { items: [{ id: 'a' }], total: 1, cursors: null } });
    expect(await collect(artists)).toHaveLength(1);
  });
});
