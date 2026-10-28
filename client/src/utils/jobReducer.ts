import type { JobState, ServerMessage } from '../../../shared/protocol.ts';

export function jobReducer(job: JobState | null, msg: ServerMessage): JobState | null {
  switch (msg.type) {
    case 'snapshot': return msg.job
    case 'job_started': return { status: 'running', dryRun: msg.dryRun, categories: msg.categories, progress: {} }
    case 'category_started':
      if (!job) return null
      return {
        ...job,
        progress: {
          ...job.progress,
          [msg.category]: { total: msg.total, removed: 0, done: false },
        },
      };

    case 'progress':
      if (!job) return null
      return {
        ...job,
        progress: {
          ...job.progress,
          [msg.category]: {
            total: msg.total,
            removed: msg.removed,
            done: false
          }
        }
      }

    case 'category_done':
      if (!job) return null
      return {
        ...job,
        progress: {
          ...job.progress,
          [msg.category]: {
            total: job.progress[msg.category]?.total ?? msg.removed,
            removed: msg.removed,
            done: true
          }
        }
      }

    case 'job_done':
      if (!job) return null
      return {
        ...job,
        status: 'done',
        summary: msg.summary
      }

    case 'job_cancelled':
      if (!job) return null
      return {

        ...job,
        summary: msg.summary,
        status: 'cancelled'
      }

    case 'job_error':
      if (!job) return null
      return {
        ...job,
        status: 'error',
        error: msg.message
      }


    default: return job
  }

}

