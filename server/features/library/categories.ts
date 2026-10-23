import type { CategoryId } from '../../../shared/protocol.ts';

export type Category = {
  id: CategoryId;
  label: string;                // shown in the UI
  endpoint: string;             // e.g. '/me/tracks'
  paging: 'offset' | 'cursor';  // artists use a cursor, the rest use offset
  uriType: string;              // 'track' → spotify:track:<id>
  wrapperKey?: string;          // see below
};

export const CATEGORIES: Category[] = [
  { id: 'playlists',  label: 'Playlists',        endpoint: '/me/playlists',             paging: 'offset', uriType: 'playlist' },
  { id: 'tracks',     label: 'Liked Songs',      endpoint: '/me/tracks',                paging: 'offset', uriType: 'track',     wrapperKey: 'track' },
  { id: 'albums',     label: 'Saved albums',     endpoint: '/me/albums',                paging: 'offset', uriType: 'album',     wrapperKey: 'album' },
  { id: 'shows',      label: 'Podcasts',         endpoint: '/me/shows',                 paging: 'offset', uriType: 'show',      wrapperKey: 'show' },
  { id: 'episodes',   label: 'Saved episodes',   endpoint: '/me/episodes',              paging: 'offset', uriType: 'episode',   wrapperKey: 'episode' },
  { id: 'audiobooks', label: 'Audiobooks',       endpoint: '/me/audiobooks',            paging: 'offset', uriType: 'audiobook' },
  { id: 'artists',    label: 'Followed artists', endpoint: '/me/following?type=artist', paging: 'cursor', uriType: 'artist' },
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