// Fake Spotify endpoints for tests. Each stub replaces global `fetch`, serves items the way
// the real endpoint pages them, and records what it was asked for.
// Call `vi.unstubAllGlobals()` in afterEach to put the real fetch back.
import { vi } from 'vitest';
import { CATEGORIES } from '../features/library/categories.ts';
import type { CategoryId } from '../../shared/protocol.ts';

type MakeItem = (index: number) => unknown;
const byIndex: MakeItem = (index) => ({ id: index });

// ── page builders: the paging rules, shared by every stub ─────────────────

// ?limit=&offset= → { items, total }
function offsetPage(params: URLSearchParams, total: number, makeItem: MakeItem) {
  const limit = Number(params.get('limit'));
  const offset = Number(params.get('offset'));
  const count = Math.max(0, Math.min(limit, total - offset));
  return { items: Array.from({ length: count }, (_, i) => makeItem(offset + i)), total };
}

// ?limit=&after=<index of the last item served> → { artists: { items, total, cursors } }
function cursorPage(params: URLSearchParams, total: number, makeItem: MakeItem) {
  const limit = Number(params.get('limit'));
  const after = params.get('after');
  const start = after === null ? 0 : Number(after) + 1;
  const count = Math.max(0, Math.min(limit, total - start));
  const items = Array.from({ length: count }, (_, i) => makeItem(start + i));
  const cursors = { after: start + count < total ? String(start + count - 1) : null };
  return { artists: { items, total, cursors } };
}

// ── single-endpoint stubs ──────────────────────────────────────────────────

// Any offset endpoint (/me/tracks, /me/albums, …). Returns the offsets requested.
export function stubOffsetSpotify(total: number, makeItem: MakeItem = byIndex): number[] {
  const offsets: number[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    const params = new URL(url).searchParams;
    offsets.push(Number(params.get('offset')));
    return new Response(JSON.stringify(offsetPage(params, total, makeItem)));
  });
  return offsets;
}

// /me/following?type=artist. Returns the cursors requested (null = no cursor on that request).
export function stubCursorSpotify(total: number, makeItem: MakeItem = byIndex): (string | null)[] {
  const afters: (string | null)[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    const params = new URL(url).searchParams;
    afters.push(params.get('after'));
    return new Response(JSON.stringify(cursorPage(params, total, makeItem)));
  });
  return afters;
}

// Any endpoint: answers every request with the same body (for odd shapes and errors).
export function stubSpotifyResponse(body: unknown, status = 200): void {
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify(body), { status }));
}

// ── whole-library stub ─────────────────────────────────────────────────────

export type RecordedRequest = { method: string; path: string; params: URLSearchParams };

// The URI the fake library gives item `index` of a category: spotify:<type>:<category>-<index>
export const fakeUri = (id: CategoryId, index: number) =>
  `spotify:${CATEGORIES.find((c) => c.id === id)!.uriType}:${id}-${index}`;

// Every category endpoint at once, with `sizes[id]` items each (0 if missing), shaped like
// the real responses (wrapped items for tracks/albums/…). Accepts DELETE /me/library.
// Returns EVERY request made, in order, so tests can check what was (not) sent.
export function stubSpotifyLibrary(sizes: Partial<Record<CategoryId, number>>): RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/v1/, '');
    const method = init?.method ?? 'GET';
    requests.push({ method, path, params: u.searchParams });

    if (method === 'DELETE' && path === '/me/library') return new Response(null, { status: 200 });

    const category = CATEGORIES.find((c) => c.endpoint.split('?')[0] === path);
    if (method !== 'GET' || !category) return new Response('{"error":"unknown endpoint"}', { status: 404 });

    const makeItem: MakeItem = (index) => {
      const obj = { id: `${category.id}-${index}` };
      return category.wrapperKey ? { [category.wrapperKey]: obj } : obj;
    };
    const total = sizes[category.id] ?? 0;
    const body = category.paging === 'cursor'
      ? cursorPage(u.searchParams, total, makeItem)
      : offsetPage(u.searchParams, total, makeItem);
    return new Response(JSON.stringify(body));
  });
  return requests;
}
