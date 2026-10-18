import { SENSITIVITIES, type Sensitivity } from '../pose/presets'

export type Plan = 'free' | 'pro'

/** Things only Pro users get. Keep in step with the locks shown in the Settings and Camera screens. */
export const PRO_FEATURES = [
  'unlimitedCaptures',
  'highSensitivity',
  'customTiming',
  'countdown',
  'bestFrame',
  'collage',
] as const

export type ProFeature = (typeof PRO_FEATURES)[number]

export const FREE_LIMITS = {
  /** Auto-captures per local day. */
  dailyCaptures: 20,
  sensitivities: ['low', 'medium'] as readonly Sensitivity[],
} as const

export const ALL_SENSITIVITIES: readonly Sensitivity[] = SENSITIVITIES

/** Every Pro feature is unlocked together; `feature` names what is being asked about. */
export function canUse(plan: Plan, _feature: ProFeature): boolean {
  return plan === 'pro'
}

export function allowedSensitivities(plan: Plan): readonly Sensitivity[] {
  return plan === 'pro' ? ALL_SENSITIVITIES : FREE_LIMITS.sensitivities
}

/** The requested sensitivity if the plan allows it, otherwise the closest level it does allow. */
export function clampSensitivity(plan: Plan, requested: Sensitivity): Sensitivity {
  const allowed = allowedSensitivities(plan)
  if (allowed.includes(requested)) return requested
  const at = (s: Sensitivity) => SENSITIVITIES.indexOf(s)
  return allowed.reduce((best, s) =>
    Math.abs(at(s) - at(requested)) < Math.abs(at(best) - at(requested)) ? s : best
  )
}

export function dailyLimit(plan: Plan): number {
  return plan === 'pro' ? Number.POSITIVE_INFINITY : FREE_LIMITS.dailyCaptures
}
