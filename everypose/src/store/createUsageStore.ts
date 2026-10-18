import { createStore, type StoreApi } from 'zustand/vanilla'
import { captureGate, recordCapture, type CaptureGate, type DailyUsage } from '../billing/usage'
import type { Plan } from '../billing/plans'
import type { createUsageRepo } from '../billing/usageRepo'

function mergeUsage(saved: DailyUsage | null, current: DailyUsage | null): DailyUsage | null {
  if (saved == null || current == null) return current ?? saved
  return saved.day === current.day ? { day: saved.day, count: saved.count + current.count } : current
}

export interface UsageState {
  usage: DailyUsage | null
  loaded: boolean
  /** Reads the saved count. Call once at startup. */
  load: () => Promise<void>
  /** Whether a capture is allowed right now, without counting it. */
  gate: (plan: Plan) => CaptureGate
  /** Counts a capture that was taken and saves the count. */
  record: () => void
}

/**
 * Keeps today's capture count in memory (the single source of truth) and saves it after each
 * change, so two quick captures can never overwrite each other.
 */
export function createUsageStore(
  repo: ReturnType<typeof createUsageRepo>,
  now: () => Date = () => new Date()
): StoreApi<UsageState> {
  return createStore<UsageState>((set, get) => ({
    usage: null,
    loaded: false,
    load: async () => {
      if (get().loaded) return // the saved count is already in memory; adding it again would double-count
      const saved = await repo.load()
      if (get().loaded) return // another load() finished first
      // Captures recorded while loading are added to what was saved for the same day.
      const merged = mergeUsage(saved, get().usage)
      const unsaved = get().usage != null
      set({ usage: merged, loaded: true })
      if (unsaved && merged != null) void repo.save(merged)
    },
    gate: (plan) => captureGate(plan, get().usage, now()),
    record: () => {
      const usage = recordCapture(get().usage, now())
      set({ usage })
      // Until the saved count has been read, writing would replace it; load() saves the merged count.
      if (get().loaded) void repo.save(usage)
    },
  }))
}
