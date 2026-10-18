import { SENSITIVITIES } from '../../pose/presets'
import { ALL_SENSITIVITIES, FREE_LIMITS, PRO_FEATURES, allowedSensitivities, canUse, clampSensitivity, dailyLimit } from '../plans'

describe('plans', () => {
  it('free users get no Pro feature, Pro users get all of them', () => {
    for (const f of PRO_FEATURES) {
      expect(canUse('free', f)).toBe(false)
      expect(canUse('pro', f)).toBe(true)
    }
  })

  it('free is limited to low and medium sensitivity, Pro gets all three', () => {
    expect(allowedSensitivities('free')).toEqual(['low', 'medium'])
    expect(allowedSensitivities('pro')).toEqual(ALL_SENSITIVITIES)
  })

  it('moves a high request down to medium on free, and leaves allowed ones alone', () => {
    expect(clampSensitivity('free', 'high')).toBe('medium')
    expect(clampSensitivity('free', 'low')).toBe('low')
    expect(clampSensitivity('free', 'medium')).toBe('medium')
    expect(clampSensitivity('pro', 'high')).toBe('high')
  })

  it('only ever returns a sensitivity the plan allows', () => {
    for (const plan of ['free', 'pro'] as const) {
      for (const level of SENSITIVITIES) {
        expect(allowedSensitivities(plan)).toContain(clampSensitivity(plan, level))
      }
    }
  })

  it('offers Pro every level the detector has', () => {
    expect(allowedSensitivities('pro')).toEqual([...SENSITIVITIES])
  })

  it('has 20 captures a day on free and no limit on Pro', () => {
    expect(dailyLimit('free')).toBe(FREE_LIMITS.dailyCaptures)
    expect(FREE_LIMITS.dailyCaptures).toBe(20)
    expect(dailyLimit('pro')).toBe(Infinity)
  })
})
