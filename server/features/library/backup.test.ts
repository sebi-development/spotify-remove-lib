import { describe, expect, it } from 'vitest';
import { toBackupEntry } from './backup.ts';
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
