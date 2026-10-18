import { dailyLimit, type Plan } from './plans'

/** How many auto-captures have been taken on one local calendar day. */
export interface DailyUsage {
  /** Local date, `YYYY-MM-DD`. */
  day: string
  count: number
}

export function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * The usage that applies today: the stored usage if it is from today, otherwise a fresh day.
 *
 * The limit lives on the device, so changing the device clock resets it. That is accepted for
 * the free tier; a hard limit would need a server to count.
 */
export function usageForToday(usage: DailyUsage | null, now: Date): DailyUsage {
  const day = localDayKey(now)
  return usage != null && usage.day === day ? usage : { day, count: 0 }
}

export interface CaptureGate {
  allowed: boolean
  /** True on Pro. `remaining` and `limit` are Infinity then, which JSON turns into null: check this flag first. */
  unlimited: boolean
  /** Captures left today; Infinity on Pro. */
  remaining: number
  /** Captures allowed per day; Infinity on Pro. */
  limit: number
  used: number
  reason?: 'daily-limit'
}

export function captureGate(plan: Plan, usage: DailyUsage | null, now: Date): CaptureGate {
  const today = usageForToday(usage, now)
  const limit = dailyLimit(plan)
  const unlimited = limit === Number.POSITIVE_INFINITY
  const remaining = Math.max(0, limit - today.count)
  return remaining > 0
    ? { allowed: true, unlimited, remaining, limit, used: today.count }
    : { allowed: false, unlimited, remaining: 0, limit, used: today.count, reason: 'daily-limit' }
}

/**
 * Checks the limit and, if a capture is allowed, counts it. Returns the gate as it was before
 * counting and the usage to keep (unchanged when blocked).
 */
export function tryCapture(
  plan: Plan,
  usage: DailyUsage | null,
  now: Date
): { gate: CaptureGate; usage: DailyUsage } {
  const gate = captureGate(plan, usage, now)
  return { gate, usage: gate.allowed ? recordCapture(usage, now) : usageForToday(usage, now) }
}

/** Counts one capture towards today without checking the limit; prefer tryCapture. */
export function recordCapture(usage: DailyUsage | null, now: Date): DailyUsage {
  const today = usageForToday(usage, now)
  return { day: today.day, count: today.count + 1 }
}
