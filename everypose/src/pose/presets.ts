import { DEFAULT_CONFIG, mergeConfig, type DetectorConfig } from './detector'

/** Ordered from least to most sensitive. */
export const SENSITIVITIES = ['low', 'medium', 'high'] as const
export type Sensitivity = (typeof SENSITIVITIES)[number]

/** Distance (in torso lengths) from the last photo that counts as a new pose. */
export const CHANGE_THRESHOLDS: Record<Sensitivity, number> = {
  low: 0.4,
  medium: 0.25,
  high: 0.15,
}

export function configForSensitivity(
  sensitivity: Sensitivity,
  overrides: Partial<DetectorConfig> = {}
): DetectorConfig {
  return mergeConfig(
    { ...DEFAULT_CONFIG, changeThreshold: CHANGE_THRESHOLDS[sensitivity] },
    overrides
  )
}
