import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCleanup } from './cleaner.ts';
import { CATEGORIES } from './categories.ts';
import type { CategoryId } from '../../../shared/protocol.ts';
import { fakeUri, stubSpotifyLibrary } from '../../test/fakeSpotify.ts';
import type { RecordedRequest } from '../../test/fakeSpotify.ts';

const getToken = async () => 'fake-token';

// A library with something in every category. Tracks and artists span several
// DELETE batches (40 URIs each) and several pages (50 items each).
const SIZES = { playlists: 2, tracks: 85, albums: 3, shows: 3, episodes: 2, audiobooks: 1, artists: 55 } satisfies Record<CategoryId, number>;
const ALL: CategoryId[] = CATEGORIES.map((c) => c.id);

const writes = (requests: RecordedRequest[]) => requests.filter((r) => r.method !== 'GET');
const deletedUris = (requests: RecordedRequest[]) =>
  writes(requests).flatMap((r) => r.params.get('uris')?.split(',') ?? []);
const urisOf = (id: CategoryId) => Array.from({ length: SIZES[id] }, (_, i) => fakeUri(id, i));

afterEach(() => vi.unstubAllGlobals());

describe('runCleanup', () => {
  // The most important test in this app: a dry run must never change the account.
  it('dry run never sends DELETE (or any other write), across every category', async () => {
    const requests = stubSpotifyLibrary(SIZES);
    const summary = await runCleanup(getToken, { categories: ALL, dryRun: true });

    expect(writes(requests)).toEqual([]);
    expect(requests.length).toBeGreaterThan(0);  // it did read the library…
    expect(summary.removed).toEqual(SIZES);      // …and reports what it WOULD remove
  });

  // The counterpart: without it, a broken delete path would make the dry-run test pass for free.
  it('real run deletes exactly the snapshot, through /me/library, in batches of at most 40', async () => {
    const requests = stubSpotifyLibrary(SIZES);
    const summary = await runCleanup(getToken, { categories: ALL, dryRun: false });

    const deletes = writes(requests);
    expect(deletes.every((r) => r.method === 'DELETE' && r.path === '/me/library')).toBe(true);
    expect(deletes.every((r) => r.params.get('uris')!.split(',').length <= 40)).toBe(true);
    expect(deletedUris(requests).sort()).toEqual(ALL.flatMap(urisOf).sort());
    expect(summary.removed).toEqual(SIZES);
  });

  it('only touches the categories that were selected', async () => {
    const requests = stubSpotifyLibrary(SIZES);
    await runCleanup(getToken, { categories: ['shows'], dryRun: false });

    expect(deletedUris(requests)).toEqual(urisOf('shows'));
    expect(requests.every((r) => r.path === '/me/shows' || r.path === '/me/library')).toBe(true);
  });

  it('a job cancelled before it starts sends nothing at all (not even a recount)', async () => {
    const requests = stubSpotifyLibrary(SIZES);
    const controller = new AbortController();
    controller.abort();
    const summary = await runCleanup(getToken, { categories: ALL, dryRun: false, signal: controller.signal });

    expect(requests).toEqual([]);
    expect(summary.cancelled).toBe(true);
  });
});

// ── remaining: what is still in the library after a real run ──────────────

// A count request is the only one that asks for limit=1 (pages ask for 50).
const countRequests = (requests: RecordedRequest[]) => requests.filter((r) => r.params.get('limit') === '1');

describe('runCleanup: remaining (recount after a real run)', () => {
  it('reports 0 left in every touched category when Spotify removed everything', async () => {
    stubSpotifyLibrary(SIZES);
    const summary = await runCleanup(getToken, { categories: ALL, dryRun: false });

    expect(summary.remaining).toEqual(Object.fromEntries(ALL.map((id) => [id, 0])));
  });

  it('items Spotify silently refuses to remove show up in remaining', async () => {
    // Like Spotify-owned playlists: DELETE answers 200, but two playlists stay.
    const refused = [fakeUri('playlists', 0), fakeUri('playlists', 1)];
    stubSpotifyLibrary(SIZES, { refuse: (uri) => refused.includes(uri) });
    const summary = await runCleanup(getToken, { categories: ['playlists', 'shows'], dryRun: false });

    expect(summary.removed.playlists).toBe(SIZES.playlists); // the server did send them…
    expect(summary.remaining).toEqual({ playlists: 2, shows: 0 }); // …the recount tells the truth
  });

  it('a dry run has no remaining and sends no count requests', async () => {
    const requests = stubSpotifyLibrary(SIZES);
    const summary = await runCleanup(getToken, { categories: ALL, dryRun: true });

    expect(summary.remaining).toBeUndefined();
    expect(countRequests(requests)).toEqual([]);
  });

  it('only the categories that ran are recounted', async () => {
    const requests = stubSpotifyLibrary(SIZES);
    const summary = await runCleanup(getToken, { categories: ['shows'], dryRun: false });

    expect(Object.keys(summary.remaining ?? {})).toEqual(['shows']);
    expect(countRequests(requests).map((r) => r.path)).toEqual(['/me/shows']);
  });

  it('cancelled after the first category: only that one is recounted', async () => {
    stubSpotifyLibrary(SIZES);
    const controller = new AbortController();
    const summary = await runCleanup(getToken, {
      categories: ALL,
      dryRun: false,
      signal: controller.signal,
      onEvent: (e) => { if (e.type === 'category_done') controller.abort(); },
    });

    expect(summary.cancelled).toBe(true);
    expect(summary.remaining).toEqual({ playlists: 0 }); // playlists is first in CATEGORIES
  });

  it('a failed recount does not fail the job: the deletions happened, remaining is just unknown', async () => {
    const requests = stubSpotifyLibrary({ shows: 3 });
    const library = globalThis.fetch;
    let deleted = false;
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') deleted = true;
      // After the deletes, every read fails (4xx: api() gives up at once, no retry wait).
      if (deleted && init?.method !== 'DELETE') return new Response('{"error":"nope"}', { status: 403 });
      return library(url, init);
    });

    const summary = await runCleanup(getToken, { categories: ['shows'], dryRun: false });

    expect(summary.removed).toEqual({ shows: 3 });
    expect(summary.remaining).toBeUndefined();
    expect(writes(requests)).toHaveLength(1);
  });
});
