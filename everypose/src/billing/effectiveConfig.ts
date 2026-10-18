import { DEFAULT_CONFIG, type DetectorConfig } from '../pose/detector'
import { configForSensitivity, type Sensitivity } from '../pose/presets'
import { canUse, clampSensitivity, type Plan } from './plans'

/** What the user picked in Settings. Timing is optional; only Pro can change it. */
export interface CaptureSettings {
  sensitivity: Sensitivity
  holdMs?: number
  cooldownMs?: number
}

export const HOLD_MS_RANGE = { min: 200, max: 1500 } as const
export const COOLDOWN_MS_RANGE = { min: 0, max: 4000 } as const

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

/** The value clamped into range, or the fallback when it is missing or not a finite number. */
const inRangeOr = (n: number | undefined, min: number, max: number, fallback: number) =>
  n != null && Number.isFinite(n) ? clamp(n, min, max) : fallback

/**
 * Turns the user's settings into a detector config, applying the plan's rules:
 * a free user's choices that need Pro fall back to the free defaults.
 */
export function detectorConfigFor(plan: Plan, settings: CaptureSettings): DetectorConfig {
  const custom = canUse(plan, 'customTiming')
  return configForSensitivity(clampSensitivity(plan, settings.sensitivity), {
    holdMs: custom
      ? inRangeOr(settings.holdMs, HOLD_MS_RANGE.min, HOLD_MS_RANGE.max, DEFAULT_CONFIG.holdMs)
      : DEFAULT_CONFIG.holdMs,
    cooldownMs: custom
      ? inRangeOr(settings.cooldownMs, COOLDOWN_MS_RANGE.min, COOLDOWN_MS_RANGE.max, DEFAULT_CONFIG.cooldownMs)
      : DEFAULT_CONFIG.cooldownMs,
  })
}
