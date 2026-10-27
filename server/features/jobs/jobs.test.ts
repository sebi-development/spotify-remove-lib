import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelJob, getJobState, startJob, subscribe } from './jobs.ts';
import { JobAlreadyRunningError } from '../../lib/errors.ts';
import { stubSpotifyLibrary } from '../../test/fakeSpotify.ts';
import type { RecordedRequest } from '../../test/fakeSpotify.ts';
import type { ServerMessage } from '../../../shared/protocol.ts';

const getToken = async () => 'fake-token';
const OPTS = { categories: ['tracks' as const], dryRun: true };

// Every test uses its own sid: the jobs module keeps its state between tests.
let counter = 0;
const newSid = () => `test-sid-${++counter}`;

// A fake Spotify that holds EVERY request until release() is called, so a job stays
// "running" for as long as the test needs.
function stubGatedSpotify(): { requests: RecordedRequest[]; release: () => void } {
  const requests = stubSpotifyLibrary({ tracks: 3 });
  const inner = globalThis.fetch;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    await gate;
    return inner(url, init);
  });
  return { requests, release };
}

const listenerThat = () => {
  const received: ServerMessage[] = [];
  return { received, listener: (msg: ServerMessage) => void received.push(msg) };
};
const types = (received: ServerMessage[]) => received.map((m) => m.type);
const libraryReads = (requests: RecordedRequest[]) => requests.filter((r) => r.path === '/me/tracks');

afterEach(() => vi.unstubAllGlobals());

describe('job entry lifecycle', () => {
  it('forgets a finished job when nobody is listening', async () => {
    stubSpotifyLibrary({ tracks: 3 });
    const sid = newSid();
    startJob(sid, getToken, OPTS);
    expect(getJobState(sid)?.status).toBe('running');

    await vi.waitFor(() => expect(getJobState(sid)).toBeNull());
  });

  it('keeps the finished job while a tab is listening, and forgets it when that tab closes', async () => {
    stubSpotifyLibrary({ tracks: 3 });
    const sid = newSid();
    const tab = listenerThat();
    const unsubscribe = subscribe(sid, tab.listener);
    startJob(sid, getToken, OPTS);

    await vi.waitFor(() => expect(types(tab.received)).toContain('job_done'));
    expect(getJobState(sid)?.status).toBe('done');

    unsubscribe();
    expect(getJobState(sid)).toBeNull();
  });
});

describe('closing tabs', () => {
  it('closing the LAST tab cancels the running job: no library request is ever sent', async () => {
    const { requests, release } = stubGatedSpotify();
    const sid = newSid();
    const tab = listenerThat();
    const unsubscribe = subscribe(sid, tab.listener);
    startJob(sid, getToken, OPTS);

    unsubscribe(); // job is held at its first request
    release();
    await vi.waitFor(() => expect(getJobState(sid)).toBeNull()); // finished (cancelled) and dropped

    expect(libraryReads(requests)).toEqual([]);
  });

  it('closing one of two tabs does NOT cancel the job', async () => {
    const { requests, release } = stubGatedSpotify();
    const sid = newSid();
    const first = listenerThat();
    const second = listenerThat();
    const closeFirst = subscribe(sid, first.listener);
    subscribe(sid, second.listener);
    startJob(sid, getToken, OPTS);

    closeFirst();
    release();
    await vi.waitFor(() => expect(types(second.received)).toContain('job_done'));

    expect(types(second.received)).not.toContain('job_cancelled');
    expect(libraryReads(requests).length).toBeGreaterThan(0);
  });

  it('an explicit cancel while a tab is open ends as job_cancelled', async () => {
    const { release } = stubGatedSpotify();
    const sid = newSid();
    const tab = listenerThat();
    subscribe(sid, tab.listener);
    startJob(sid, getToken, OPTS);

    cancelJob(sid);
    release();
    await vi.waitFor(() => expect(types(tab.received)).toContain('job_cancelled'));
  });

  it('cancelJob for a session that never had anything is a harmless no-op', () => {
    const sid = newSid();
    expect(() => cancelJob(sid)).not.toThrow();
    expect(getJobState(sid)).toBeNull();
  });
});

describe('startJob', () => {
  it('refuses a second job while one is running', async () => {
    const { release } = stubGatedSpotify();
    const sid = newSid();
    const tab = listenerThat();
    subscribe(sid, tab.listener);
    startJob(sid, getToken, OPTS);

    expect(() => startJob(sid, getToken, OPTS)).toThrow(JobAlreadyRunningError);

    release();
    await vi.waitFor(() => expect(types(tab.received)).toContain('job_done'));
  });
});
