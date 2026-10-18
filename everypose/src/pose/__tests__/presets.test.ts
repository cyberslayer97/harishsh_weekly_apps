import { DEFAULT_CONFIG } from '../detector'
import { CHANGE_THRESHOLDS, configForSensitivity } from '../presets'

describe('configForSensitivity', () => {
  it('orders thresholds from least to most sensitive', () => {
    expect(CHANGE_THRESHOLDS.low).toBeGreaterThan(CHANGE_THRESHOLDS.medium)
    expect(CHANGE_THRESHOLDS.medium).toBeGreaterThan(CHANGE_THRESHOLDS.high)
  })

  it('keeps the other defaults', () => {
    expect(configForSensitivity('high')).toEqual({ ...DEFAULT_CONFIG, changeThreshold: CHANGE_THRESHOLDS.high })
  })

  it('ignores overrides that are undefined', () => {
    expect(configForSensitivity('low', { holdMs: undefined }).holdMs).toBe(DEFAULT_CONFIG.holdMs)
  })

  it('lets overrides win', () => {
    const c = configForSensitivity('low', { holdMs: 800, changeThreshold: 0.9 })
    expect(c.holdMs).toBe(800)
    expect(c.changeThreshold).toBe(0.9)
  })
})
