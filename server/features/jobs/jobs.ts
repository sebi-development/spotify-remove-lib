import type { CategoryId, CleanupEvent, JobState, ServerMessage } from "../../../shared/protocol.ts";
import { runCleanup } from "../library/cleaner.ts";

type Listener = (msg: ServerMessage) => void

type Job = {
  state: JobState,
  controller: AbortController,

}

type Entry = {
  listeners: Set<Listener>;
  job: Job | null
}

const entries = new Map<string, Entry>();

function applyEvent(state: JobState, e: CleanupEvent): void {
  switch (e.type) {
    case 'category_started':
      state.progress[e.category] = { total: e.total, removed: 0, done: false };
      break;
    case 'progress':
      state.progress[e.category] = { total: e.total, removed: e.removed, done: false };
      break;
    case 'category_done': {
      const prev = state.progress[e.category];
      state.progress[e.category] = { total: prev?.total ?? e.removed, removed: e.removed, done: true };
      break;
    }
  }
}

export function getEntry(sid: string): Entry {
  let entry = entries.get(sid);
  if (!entry) {
    entry = { listeners: new Set(), job: null };
    entries.set(sid, entry);
  }
  return entry;
}

export function getJobState(sid: string): JobState | null {
  return entries.get(sid)?.job?.state ?? null
}

export function subscribe(sid: string, listener: Listener): () => void {
  const entry = getEntry(sid)
  entry.listeners.add(listener)
  return () => entry.listeners.delete(listener)
}

function publish(sid: string, msg: ServerMessage) {
  const entry = entries.get(sid);
  if (!entry) return;
  for (const listener of entry.listeners) {
    try {
      listener(msg);
    } catch (error) {
      console.error('Listener failed:', error);
    }
  }
}

export function startJob(
  sid: string,
  getToken: () => Promise<string>,
  opts: { categories: CategoryId[]; dryRun: boolean },
): void {
  const entry = getEntry(sid);

  if (entry.job?.state.status === 'running') throw new Error('A job is already running')

  const controller = new AbortController()
  const state: JobState = { status: 'running', dryRun: opts.dryRun, categories: opts.categories, progress: {} }
  entry.job = { state, controller }

  publish(sid, { type: 'job_started', categories: opts.categories, dryRun: opts.dryRun })

  runCleanup(getToken, { categories: opts.categories, dryRun: opts.dryRun, signal: controller.signal, onEvent: (e) => { applyEvent(state, e); publish(sid, e) } })
    .then((summary) => {
      state.summary = summary
      state.status = summary.cancelled ? 'cancelled' : 'done'
      publish(sid, { type: summary.cancelled ? 'job_cancelled' : 'job_done', summary })
    })
    .catch((error) => {
      console.error(error)
      state.status = 'error'
      state.error = 'Cleanup failed'
      publish(sid, { type: 'job_error', message: 'Cleanup failed' })
    })
}

export function cancelJob(sid: string): void {
  const entryJob = getEntry(sid).job
  if (entryJob?.state.status === 'running') {
    entryJob.controller.abort()
  }
}