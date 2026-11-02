import { z } from 'zod';

// One list, used twice: at runtime (validation, loops) and as a type.
export const CATEGORY_IDS = [
  'playlists',
  'tracks',
  'albums',
  'shows',
  'episodes',
  'audiobooks',
  'artists',
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

// What the UI calls each category. Record<CategoryId, …> makes a missing or extra id a compile error.
export const CATEGORY_LABELS: Record<CategoryId, string> = {
  playlists: 'Playlists',
  tracks: 'Liked Songs',
  albums: 'Saved albums',
  shows: 'Podcasts',
  episodes: 'Saved episodes',
  audiobooks: 'Audiobooks',
  artists: 'Followed artists',
};

// ── What the cleaning engine reports while it runs ─────────────────────────
export type CleanupEvent =
  | { type: 'category_started'; category: CategoryId; total: number }
  | { type: 'progress'; category: CategoryId; removed: number; total: number }
  | { type: 'category_done'; category: CategoryId; removed: number };

export type CleanupSummary = {
  removed: Partial<Record<CategoryId, number>>;
  remaining?: Partial<Record<CategoryId, number>> | undefined; 
  cancelled: boolean;
  seconds: number;
};

// What a (re)connecting browser needs to redraw the current state of a run.
export type JobState = {
  status: 'running' | 'done' | 'cancelled' | 'error';
  dryRun: boolean;
  categories: CategoryId[];
  progress: Partial<Record<CategoryId, { total: number; removed: number; done: boolean }>>;
  summary?: CleanupSummary | undefined;
  error?: string | undefined;
};

// ── Browser → server ───────────────────────────────────────────────────────

export type ClientMessage = z.infer<typeof ClientMessageSchema>

// ── Server → browser ───────────────────────────────────────────────────────

export type ServerMessage =
  | CleanupEvent
  | { type: 'snapshot'; job: JobState | null }
  | { type: 'job_started'; categories: CategoryId[]; dryRun: boolean }
  | { type: 'job_done'; summary: CleanupSummary }
  | { type: 'job_cancelled'; summary: CleanupSummary }
  | { type: 'job_error'; message: string }
  | { type: 'error'; message: string };

export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('start'),
    categories: z.array(z.enum(CATEGORY_IDS)).min(1),
    dryRun: z.boolean(), // required on purpose: no default for a destructive action
    confirm: z.literal('DELETE')
  }),
  z.object({type: z.literal('cancel')})
])
