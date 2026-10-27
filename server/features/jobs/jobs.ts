import type { CategoryId, CleanupEvent, JobState, ServerMessage } from "../../../shared/protocol.ts";
import { runCleanup } from "../library/cleaner.ts";
import { api } from "../../lib/spotify.ts";
import { JobAlreadyRunningError } from "../../lib/errors.ts";

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
  return () => {
    entry.listeners.delete(listener)
    // Last tab gone = the user quit: stop the job instead of wiping with nobody watching.
    if (entry.listeners.size === 0) cancelJob(sid)
    dropIfIdle(sid)
  }
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

// "Name" (id) of the account the token belongs to, for the log. Never blocks a job: if /me fails, say so.
async function describeAccount(getToken: () => Promise<string>): Promise<string> {
  try {
    const me = await api(getToken, '/me') as { id: string; display_name?: string };
    return `"${me.display_name ?? me.id}" (${me.id})`;
  } catch {
    return 'unknown account';
  }
}

export function startJob(
  sid: string,
  getToken: () => Promise<string>,
  opts: { categories: CategoryId[]; dryRun: boolean },
): void {
  const entry = getEntry(sid);

  if (entry.job?.state.status === 'running') throw new JobAlreadyRunningError()


  const controller = new AbortController()
  const state: JobState = { status: 'running', dryRun: opts.dryRun, categories: opts.categories, progress: {} }
  entry.job = { state, controller }

  publish(sid, { type: 'job_started', categories: opts.categories, dryRun: opts.dryRun })
  const mode = opts.dryRun ? 'DRY RUN' : 'REAL WIPE'

  describeAccount(getToken)
    .then((account) => {
      console.log(`[job] start ${mode} for ${account} categories=${opts.categories.join(',')}`)
      return runCleanup(getToken, { categories: opts.categories, dryRun: opts.dryRun, signal: controller.signal, onEvent: (e) => { applyEvent(state, e); publish(sid, e) } })
    })
    .then((summary) => {
      state.summary = summary
      state.status = summary.cancelled ? 'cancelled' : 'done'
      publish(sid, { type: summary.cancelled ? 'job_cancelled' : 'job_done', summary })
      console.log(`[job] ${state.status} ${mode} removed=${JSON.stringify(summary.removed)}`)
    })
    .catch((error) => {
      console.error(`[job] error ${mode}:`, error)
      state.status = 'error'
      state.error = 'Cleanup failed'
      publish(sid, { type: 'job_error', message: 'Cleanup failed' })
    })
    .finally(() => dropIfIdle(sid))
}

export function cancelJob(sid: string): void {
  // entries.get, not getEntry: cancelling must not create an entry nobody will ever drop.
  const entryJob = entries.get(sid)?.job
  if (entryJob?.state.status === 'running') {
    entryJob.controller.abort()
  }
}

function dropIfIdle(sid: string): void {
  const entry = entries.get(sid)
  if (!entry) return

  const running = entry.job?.state.status === 'running'
  const watched = entry.listeners.size > 0
  if (!running && !watched) entries.delete(sid)
}