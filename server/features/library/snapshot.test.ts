import { afterEach, describe, expect, it, vi } from 'vitest';
import { snapshotCategory } from './snapshot.ts';
import { CATEGORIES } from './categories.ts';
import type { CategoryId } from '../../../shared/protocol.ts';
import { stubCursorSpotify, stubOffsetSpotify, stubSpotifyResponse } from '../../test/fakeSpotify.ts';

const category = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!;
const getToken = async () => 'fake-token';

afterEach(() => vi.unstubAllGlobals());

describe('snapshotCategory', () => {
  it('unwraps wrapped items (saved tracks are { track: {...} }) into track URIs', async () => {
    stubOffsetSpotify(3, (i) => ({ added_at: '2026-01-01', track: { id: `t${i}` } }));
    expect(await snapshotCategory(getToken, category('tracks'))).toEqual([
      'spotify:track:t0',
      'spotify:track:t1',
      'spotify:track:t2',
    ]);
  });

  it('reads unwrapped items (playlists are the object itself) into playlist URIs', async () => {
    stubOffsetSpotify(2, (i) => ({ id: `p${i}`, name: `Playlist ${i}` }));
    expect(await snapshotCategory(getToken, category('playlists'))).toEqual([
      'spotify:playlist:p0',
      'spotify:playlist:p1',
    ]);
  });

  it('builds artist URIs through cursor paging', async () => {
    stubCursorSpotify(2, (i) => ({ id: `a${i}` }));
    expect(await snapshotCategory(getToken, category('artists'))).toEqual(['spotify:artist:a0', 'spotify:artist:a1']);
  });

  it('collects every page, in order (120 tracks = 3 pages)', async () => {
    stubOffsetSpotify(120, (i) => ({ track: { id: `t${i}` } }));
    const uris = await snapshotCategory(getToken, category('tracks'));
    expect(uris).toHaveLength(120);
    expect(uris[0]).toBe('spotify:track:t0');
    expect(uris[119]).toBe('spotify:track:t119');
    expect(new Set(uris).size).toBe(120); // no duplicates across page boundaries
  });

  it('skips items that have no id instead of producing a broken URI', async () => {
    const items = [
      { track: { id: 'ok1' } },
      { track: null },                         // track no longer available
      { track: { id: null, is_local: true } }, // local file: never has a Spotify id
      {},                                      // wrapper missing entirely
      { track: { id: 'ok2' } },
    ];
    stubOffsetSpotify(items.length, (i) => items[i]);
    expect(await snapshotCategory(getToken, category('tracks'))).toEqual(['spotify:track:ok1', 'spotify:track:ok2']);
  });

  it('returns an empty list for an empty library', async () => {
    stubOffsetSpotify(0);
    expect(await snapshotCategory(getToken, category('albums'))).toEqual([]);
  });

  it('propagates an API failure instead of returning a partial list', async () => {
    stubSpotifyResponse({ error: { status: 403 } }, 403);
    await expect(snapshotCategory(getToken, category('tracks'))).rejects.toThrow(/API Error \[403\]/);
  });
});
