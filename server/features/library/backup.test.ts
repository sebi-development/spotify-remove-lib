import { afterEach, describe, expect, it, vi } from 'vitest';
import { backupChunks, toBackupEntry } from './backup.ts';
import { stubOffsetSpotify, stubSpotifyLibrary, stubSpotifyResponse } from '../../test/fakeSpotify.ts';
import { CATEGORIES } from './categories.ts';
import type { CategoryId } from '../../../shared/protocol.ts';

const category = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!;

describe('toBackupEntry', () => {
  // One realistic item per category, shaped like Spotify's real responses (trimmed).
  it.each([
    ['tracks', { added_at: '2026-01-01', track: { id: 't1', name: 'Song', artists: [{ name: 'A' }, { name: 'B' }] } },
      { uri: 'spotify:track:t1', name: 'Song', by: 'A, B' }],
    ['albums', { added_at: '2026-01-01', album: { id: 'al1', name: 'Album', artists: [{ name: 'Band' }] } },
      { uri: 'spotify:album:al1', name: 'Album', by: 'Band' }],
    ['shows', { show: { id: 's1', name: 'Podcast', publisher: 'Studio' } },
      { uri: 'spotify:show:s1', name: 'Podcast', by: 'Studio' }],
    ['episodes', { episode: { id: 'e1', name: 'Ep 1', show: { name: 'Podcast' } } },
      { uri: 'spotify:episode:e1', name: 'Ep 1', by: 'Podcast' }],
    ['audiobooks', { id: 'b1', name: 'Book', authors: [{ name: 'Writer' }] },
      { uri: 'spotify:audiobook:b1', name: 'Book', by: 'Writer' }],
    ['playlists', { id: 'p1', name: 'Mix', owner: { display_name: 'Seb' } },
      { uri: 'spotify:playlist:p1', name: 'Mix', by: 'Seb' }],
    ['artists', { id: 'ar1', name: 'Artist' },
      { uri: 'spotify:artist:ar1', name: 'Artist', by: undefined }],
  ] as const)('%s: unwraps the item and reads its "by" field', (id, item, expected) => {
    expect(toBackupEntry(category(id), item)).toEqual(expected);
  });

  it('artists have no "by", so the key disappears from the JSON', () => {
    const entry = toBackupEntry(category('artists'), { id: 'ar1', name: 'Artist' });
    expect(JSON.stringify(entry)).toBe('{"uri":"spotify:artist:ar1","name":"Artist"}');
  });

  it.each([
    ['tracks', { track: null }, 'track no longer available'],
    ['tracks', { track: { id: null, name: 'Local file', is_local: true } }, 'local file'],
    ['albums', {}, 'wrapper missing'],
    ['playlists', { name: 'No id' }, 'no id'],
    ['playlists', null, 'null item'],
  ] as const)('%s: returns null when there is no URI (%s)', (id, item, _reason) => {
    expect(toBackupEntry(category(id), item)).toBeNull();
  });

  it('tolerates missing nested fields instead of crashing', () => {
    expect(toBackupEntry(category('episodes'), { episode: { id: 'e1', name: 'Ep', show: null } }))
      .toEqual({ uri: 'spotify:episode:e1', name: 'Ep', by: undefined });
    expect(toBackupEntry(category('tracks'), { track: { id: 't1', name: 'Song' } }))     // no artists list
      .toEqual({ uri: 'spotify:track:t1', name: 'Song', by: undefined });
    expect(toBackupEntry(category('playlists'), { id: 'p1', name: 'Mix', owner: null }))
      .toEqual({ uri: 'spotify:playlist:p1', name: 'Mix', by: undefined });
  });

  it('falls back to an empty name rather than undefined', () => {
    expect(toBackupEntry(category('shows'), { show: { id: 's1', publisher: 'Studio' } }))
      .toEqual({ uri: 'spotify:show:s1', name: '', by: 'Studio' });
  });
});

// ── backupChunks: the streamed file ────────────────────────────────────────

const getToken = async () => 'fake-token';

async function readAll(categories: CategoryId[]): Promise<{ text: string; chunks: string[] }> {
  const chunks: string[] = [];
  for await (const chunk of backupChunks(getToken, categories.map(category))) chunks.push(chunk);
  return { text: chunks.join(''), chunks };
}

// Parses the joined chunks; throws (failing the test) if a single comma is out of place.
async function readBackup(categories: CategoryId[]) {
  return JSON.parse((await readAll(categories)).text) as {
    exportedAt: string;
    categories: Record<string, { uri: string; name: string; by?: string }[]>;
  };
}

const song = (i: number) => ({ track: { id: `t${i}`, name: `Song ${i}`, artists: [{ name: 'Band' }] } });
const localFile = () => ({ track: { id: null, name: 'Local', is_local: true } });

describe('backupChunks', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('joins into valid JSON with a timestamp and one array per selected category, in order', async () => {
    stubSpotifyLibrary({ tracks: 120, shows: 3, albums: 0 });
    const backup = await readBackup(['tracks', 'shows', 'albums']);

    expect(Number.isNaN(Date.parse(backup.exportedAt))).toBe(false);
    expect(Object.keys(backup.categories)).toEqual(['tracks', 'shows', 'albums']);
    expect(backup.categories.tracks).toHaveLength(120); // 3 pages
    expect(backup.categories.tracks![119]!.uri).toBe('spotify:track:tracks-119');
    expect(backup.categories.shows).toHaveLength(3);
    expect(backup.categories.albums).toEqual([]); // empty category is still written
  });

  it('stays valid when the LAST item is skipped (the trailing-comma trap)', async () => {
    stubOffsetSpotify(5, (i) => (i === 4 ? localFile() : song(i)));
    const backup = await readBackup(['tracks']);
    expect(backup.categories.tracks!.map((e) => e.uri)).toEqual(
      ['spotify:track:t0', 'spotify:track:t1', 'spotify:track:t2', 'spotify:track:t3'],
    );
  });

  it('stays valid when a whole page is skipped (page 2 is only local files)', async () => {
    stubOffsetSpotify(60, (i) => (i >= 50 ? localFile() : song(i)));
    expect((await readBackup(['tracks'])).categories.tracks).toHaveLength(50);
  });

  it('stays valid when the FIRST page is skipped and later ones are not', async () => {
    stubOffsetSpotify(60, (i) => (i < 50 ? localFile() : song(i)));
    expect((await readBackup(['tracks'])).categories.tracks).toHaveLength(10);
  });

  it('writes an empty array when every item is skipped', async () => {
    stubOffsetSpotify(3, localFile);
    expect((await readBackup(['tracks'])).categories.tracks).toEqual([]);
  });

  it('writes an empty categories object when nothing is selected', async () => {
    stubSpotifyLibrary({});
    expect((await readBackup([])).categories).toEqual({});
  });

  it('escapes names safely (quotes, backslashes, newlines, emoji)', async () => {
    const name = 'Say "Hi" \\ back\nslash 🎵';
    stubOffsetSpotify(1, () => ({ track: { id: 't0', name, artists: [{ name: 'The "Band"' }] } }));
    const [entry] = (await readBackup(['tracks'])).categories.tracks!;
    expect(entry).toEqual({ uri: 'spotify:track:t0', name, by: 'The "Band"' });
  });

  it('streams: the first items come out before later pages are even requested', async () => {
    const offsets = stubOffsetSpotify(120, song);
    const stream = backupChunks(getToken, [category('tracks')]);
    await stream.next(); // {"exportedAt":…
    await stream.next(); // "tracks":[
    const firstPage = await stream.next(); // the first 50 entries
    expect(firstPage.value).toContain('spotify:track:t0');
    expect(offsets).toEqual([0]); // pages 2 and 3 not fetched yet
  });

  it('writes one chunk per page, not one per item', async () => {
    stubOffsetSpotify(120, song);
    const { chunks } = await readAll(['tracks']);
    // header + "tracks":[ + 3 pages + ] + }}
    expect(chunks).toHaveLength(7);
  });

  it('propagates a Spotify failure so the route can abort the download', async () => {
    // 4xx, not 5xx: api() retries 5xx with backoff (seconds), which a unit test shouldn't wait for
    stubSpotifyResponse({ error: { status: 403 } }, 403);
    await expect(readAll(['tracks'])).rejects.toThrow(/API Error/);
  });
});
