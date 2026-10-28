import { describe, expect, it } from 'vitest';
import { jobReducer } from './jobReducer.ts';
import type { JobState, ServerMessage } from '../../../shared/protocol.ts';

const summary = { removed: { tracks: 33 }, cancelled: false, seconds: 1.2 };
const cancelledSummary = { removed: { tracks: 10 }, cancelled: true, seconds: 0.4 };

const running = (overrides: Partial<JobState> = {}): JobState => ({
  status: 'running',
  dryRun: true,
  categories: ['tracks', 'episodes'],
  progress: {},
  ...overrides,
});

// A frozen object throws if the reducer tries to change it (ES modules run in strict mode).
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const run = (start: JobState | null, messages: ServerMessage[]) =>
  messages.reduce<JobState | null>((job, msg) => jobReducer(job, msg), start);

describe('jobReducer', () => {
  it('follows a whole run, category by category', () => {
    const job = run(null, [
      { type: 'snapshot', job: null },
      { type: 'job_started', categories: ['tracks', 'episodes'], dryRun: true },
      { type: 'category_started', category: 'tracks', total: 85 },
      { type: 'progress', category: 'tracks', removed: 40, total: 85 },
      { type: 'progress', category: 'tracks', removed: 85, total: 85 },
      { type: 'category_done', category: 'tracks', removed: 85 },
      { type: 'category_started', category: 'episodes', total: 6 },
      { type: 'category_done', category: 'episodes', removed: 6 },
      { type: 'job_done', summary },
    ]);

    expect(job).toEqual({
      status: 'done',
      dryRun: true,
      categories: ['tracks', 'episodes'],
      progress: {
        tracks: { total: 85, removed: 85, done: true },
        episodes: { total: 6, removed: 6, done: true },
      },
      summary,
    });
  });

  it('a progress message updates only its own category', () => {
    const start = running({ progress: { tracks: { total: 85, removed: 85, done: true }, episodes: { total: 6, removed: 0, done: false } } });
    const job = jobReducer(start, { type: 'progress', category: 'episodes', removed: 3, total: 6 });
    expect(job?.progress).toEqual({
      tracks: { total: 85, removed: 85, done: true },
      episodes: { total: 6, removed: 3, done: false },
    });
  });

  it('category_done keeps the known total; without one it falls back to the removed count', () => {
    const known = jobReducer(running({ progress: { tracks: { total: 85, removed: 40, done: false } } }),
      { type: 'category_done', category: 'tracks', removed: 40 });
    expect(known?.progress.tracks).toEqual({ total: 85, removed: 40, done: true }); // stopped early: removed < total

    const unknown = jobReducer(running(), { type: 'category_done', category: 'tracks', removed: 7 });
    expect(unknown?.progress.tracks).toEqual({ total: 7, removed: 7, done: true });
  });

  it('a cancelled job keeps its progress and the partial summary', () => {
    const start = running({ progress: { tracks: { total: 85, removed: 10, done: true } } });
    const job = jobReducer(start, { type: 'job_cancelled', summary: cancelledSummary });
    expect(job).toMatchObject({ status: 'cancelled', summary: cancelledSummary, progress: start.progress });
  });

  it('a failed job keeps its progress and records the message', () => {
    const start = running({ progress: { tracks: { total: 85, removed: 10, done: false } } });
    const job = jobReducer(start, { type: 'job_error', message: 'Cleanup failed' });
    expect(job).toMatchObject({ status: 'error', error: 'Cleanup failed', progress: start.progress });
  });

  it('a new job replaces a finished one completely (no old summary or progress)', () => {
    const finished = running({ status: 'done', summary, progress: { tracks: { total: 1, removed: 1, done: true } } });
    const job = jobReducer(finished, { type: 'job_started', categories: ['shows'], dryRun: false });
    expect(job).toEqual({ status: 'running', dryRun: false, categories: ['shows'], progress: {} });
    expect(job).not.toHaveProperty('summary');
  });

  it('a snapshot replaces whatever the tab had (reconnect / second tab)', () => {
    const snapshot = running({ progress: { tracks: { total: 85, removed: 40, done: false } } });
    expect(jobReducer(null, { type: 'snapshot', job: snapshot })).toEqual(snapshot);
    expect(jobReducer(snapshot, { type: 'snapshot', job: null })).toBeNull();
  });

  it.each<ServerMessage>([
    { type: 'category_started', category: 'tracks', total: 5 },
    { type: 'progress', category: 'tracks', removed: 1, total: 5 },
    { type: 'category_done', category: 'tracks', removed: 5 },
    { type: 'job_done', summary },
    { type: 'job_cancelled', summary: cancelledSummary },
    { type: 'job_error', message: 'x' },
  ])('$type with no job is ignored (stays null)', (msg) => {
    expect(jobReducer(null, msg)).toBeNull();
  });

  it('messages that are not about the job leave the very same object', () => {
    const start = running();
    expect(jobReducer(start, { type: 'error', message: 'A job is already running' })).toBe(start);
  });

  it('never changes its input: every step returns a new object (React compares by identity)', () => {
    let job: JobState | null = deepFreeze(running());
    const messages: ServerMessage[] = [
      { type: 'category_started', category: 'tracks', total: 5 },
      { type: 'progress', category: 'tracks', removed: 2, total: 5 },
      { type: 'category_done', category: 'tracks', removed: 5 },
      { type: 'job_done', summary },
    ];
    for (const msg of messages) {
      const next = jobReducer(job, msg);
      expect(next).not.toBe(job);
      job = deepFreeze(next);
    }
  });
});
