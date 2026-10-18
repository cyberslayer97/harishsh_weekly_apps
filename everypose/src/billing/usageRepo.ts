import type { DailyUsage } from './usage'

/** The part of AsyncStorage we use, so tests can pass an in-memory version. */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
}

export const USAGE_STORAGE_KEY = 'everypose.usage.v1'

/** Far above anything a person can take in a day; guards against absurd stored values. */
const MAX_COUNT = 100_000

function isRealDay(day: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (m == null) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(y, mo - 1, d)
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d
}

function isDailyUsage(value: unknown): value is DailyUsage {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.day === 'string' &&
    isRealDay(v.day) &&
    typeof v.count === 'number' &&
    Number.isSafeInteger(v.count) &&
    v.count >= 0 &&
    v.count <= MAX_COUNT
  )
}

/**
 * Reads and writes today's usage. Neither method throws: a storage problem must not stop the
 * camera. If storage cannot be read, `load` returns null and the count starts again from zero
 * (fails open on purpose).
 *
 * Load once at startup and keep the count in memory, saving after each capture; do not
 * load-modify-save per capture, or two quick captures can overwrite each other.
 */
export function createUsageRepo(storage: KeyValueStorage) {
  return {
    /** Stored usage, or null when nothing valid is stored (first run, or the data is damaged). */
    async load(): Promise<DailyUsage | null> {
      try {
        const raw = await storage.getItem(USAGE_STORAGE_KEY)
        if (raw == null) return null
        const parsed: unknown = JSON.parse(raw)
        return isDailyUsage(parsed) ? parsed : null
      } catch {
        return null
      }
    },
    /** Returns whether the write worked. */
    async save(usage: DailyUsage): Promise<boolean> {
      try {
        await storage.setItem(USAGE_STORAGE_KEY, JSON.stringify(usage))
        return true
      } catch {
        return false
      }
    },
  }
}
