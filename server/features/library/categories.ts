import type { CategoryId } from '../../../shared/protocol.ts';

export type Category = {
  id: CategoryId;
  endpoint: string;             // e.g. '/me/tracks'
  paging: 'offset' | 'cursor';  // artists use a cursor, the rest use offset
  uriType: string;              // 'track' → spotify:track:<id>
  wrapperKey?: string;          // see below
};

export const CATEGORIES: Category[] = [
  { id: 'playlists',   endpoint: '/me/playlists',              paging: 'offset', uriType: 'playlist' },
  { id: 'tracks',      endpoint: '/me/tracks',                 paging: 'offset', uriType: 'track',     wrapperKey: 'track' },
  { id: 'albums',      endpoint: '/me/albums',                 paging: 'offset', uriType: 'album',     wrapperKey: 'album' },
  { id: 'shows',       endpoint: '/me/shows',                  paging: 'offset', uriType: 'show',      wrapperKey: 'show' },
  { id: 'episodes',    endpoint: '/me/episodes',               paging: 'offset', uriType: 'episode',   wrapperKey: 'episode' },
  { id: 'audiobooks',  endpoint: '/me/audiobooks',             paging: 'offset', uriType: 'audiobook' },
  { id: 'artists',     endpoint: '/me/following?type=artist',  paging: 'cursor', uriType: 'artist' },
];

// Saved tracks/albums/shows/episodes come wrapped ({ added_at, track: {...} });
// playlists, audiobooks and artists are the object itself. Returns the object either way
// (undefined for a wrapper whose object is gone, e.g. { track: null }).
export function unwrap(category: Category, item: any): any {
  return category.wrapperKey ? item?.[category.wrapperKey] : item;
}

export function toUri(category: Category, item: any): string | null {
  const obj = unwrap(category, item);

  if(obj?.id) return `spotify:${category.uriType}:${obj.id}`
  return null
}