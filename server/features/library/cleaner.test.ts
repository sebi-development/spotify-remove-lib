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

  it('a job cancelled before it starts sends nothing at all', async () => {
    const requests = stubSpotifyLibrary(SIZES);
    const controller = new AbortController();
    controller.abort();
    const summary = await runCleanup(getToken, { categories: ALL, dryRun: false, signal: controller.signal });

    expect(requests).toEqual([]);
    expect(summary.cancelled).toBe(true);
  });
});
