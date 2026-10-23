
const BASE_URL = 'https://api.spotify.com/v1';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Appends query params to an endpoint, picking `?` or `&` depending on whether
 * the endpoint already has a query string (e.g. '/me/following?type=artist').
 */
export function withQuery(endpoint: string, params: Record<string, string | number>): string {
  const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}${query}`;
}

/**
 * Thin fetch wrapper around the Spotify REST API.
 * Handles 429 rate-limit back-off and transient 5xx retries automatically.
 */
export async function api(
  getToken: () => Promise<string>,
  endpoint: string,
  method: string = 'GET',
  body?: object): Promise<unknown> {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${await getToken()}`,
      'Content-Type': 'application/json',
    };
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      ...(body && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15_000)
    });

    if (res.status === 429) {
      const retryAfter = Math.min(Number(res.headers.get('Retry-After') ?? '2'), 60);
      await sleep((retryAfter + 1) * 1000);
      continue;
    }

    if (res.status >= 500 && attempt < 6) {
      await sleep(1000 * attempt);
      continue;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API Error [${res.status}] ${method} ${endpoint}: ${errText}`);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  throw new Error(`Too many retries: ${method} ${endpoint}`);
}
