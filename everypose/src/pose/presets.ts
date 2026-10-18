import { DEFAULT_CONFIG, mergeConfig, type DetectorConfig } from './detector'

export type Sensitivity = 'low' | 'medium' | 'high'

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
