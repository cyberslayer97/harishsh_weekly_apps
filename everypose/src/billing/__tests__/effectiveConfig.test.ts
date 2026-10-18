import { DEFAULT_CONFIG } from '../../pose/detector'
import { CHANGE_THRESHOLDS } from '../../pose/presets'
import { COOLDOWN_MS_RANGE, HOLD_MS_RANGE, detectorConfigFor } from '../effectiveConfig'

describe('detectorConfigFor', () => {
  it('free: uses the chosen allowed sensitivity and the default timing', () => {
    const c = detectorConfigFor('free', { sensitivity: 'low', holdMs: 900, cooldownMs: 100 })
    expect(c.changeThreshold).toBe(CHANGE_THRESHOLDS.low)
    expect(c.holdMs).toBe(DEFAULT_CONFIG.holdMs)
    expect(c.cooldownMs).toBe(DEFAULT_CONFIG.cooldownMs)
  })

  it('free: high sensitivity falls back to medium', () => {
    expect(detectorConfigFor('free', { sensitivity: 'high' }).changeThreshold).toBe(CHANGE_THRESHOLDS.medium)
  })

  it('pro: gets high sensitivity and its own timing', () => {
    const c = detectorConfigFor('pro', { sensitivity: 'high', holdMs: 800, cooldownMs: 3000 })
    expect(c.changeThreshold).toBe(CHANGE_THRESHOLDS.high)
    expect(c.holdMs).toBe(800)
    expect(c.cooldownMs).toBe(3000)
  })

  it('pro: falls back to default timing when none is chosen', () => {
    const c = detectorConfigFor('pro', { sensitivity: 'medium' })
    expect(c.holdMs).toBe(DEFAULT_CONFIG.holdMs)
    expect(c.cooldownMs).toBe(DEFAULT_CONFIG.cooldownMs)
  })

  it('pro: ignores timing that is not a number', () => {
    const c = detectorConfigFor('pro', { sensitivity: 'medium', holdMs: NaN, cooldownMs: Infinity })
    expect(c.holdMs).toBe(DEFAULT_CONFIG.holdMs)
    expect(c.cooldownMs).toBe(DEFAULT_CONFIG.cooldownMs)
  })

  it('pro: keeps timing inside the allowed range', () => {
    const low = detectorConfigFor('pro', { sensitivity: 'medium', holdMs: 0, cooldownMs: -50 })
    expect(low.holdMs).toBe(HOLD_MS_RANGE.min)
    expect(low.cooldownMs).toBe(COOLDOWN_MS_RANGE.min)
    const high = detectorConfigFor('pro', { sensitivity: 'medium', holdMs: 99999, cooldownMs: 99999 })
    expect(high.holdMs).toBe(HOLD_MS_RANGE.max)
    expect(high.cooldownMs).toBe(COOLDOWN_MS_RANGE.max)
  })
})
