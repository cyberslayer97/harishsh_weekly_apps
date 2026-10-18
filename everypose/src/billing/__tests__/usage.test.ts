import { captureGate, localDayKey, recordCapture, tryCapture, usageForToday, type DailyUsage } from '../usage'

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min)

describe('localDayKey', () => {
  it('uses the local calendar date, zero padded', () => {
    expect(localDayKey(at(2026, 3, 5))).toBe('2026-03-05')
    expect(localDayKey(at(2026, 12, 31, 23, 59))).toBe('2026-12-31')
    expect(localDayKey(at(2026, 1, 1, 0, 0))).toBe('2026-01-01')
  })
})

describe('usageForToday', () => {
  it('starts at zero when nothing is stored', () => {
    expect(usageForToday(null, at(2026, 10, 18))).toEqual({ day: '2026-10-18', count: 0 })
  })

  it('keeps today\'s count', () => {
    const stored: DailyUsage = { day: '2026-10-18', count: 7 }
    expect(usageForToday(stored, at(2026, 10, 18, 23, 59))).toBe(stored)
  })

  it('starts over after midnight', () => {
    const stored: DailyUsage = { day: '2026-10-18', count: 20 }
    expect(usageForToday(stored, at(2026, 10, 19, 0, 0))).toEqual({ day: '2026-10-19', count: 0 })
  })

  it('uses the device date, so a different day starts a fresh count in either direction', () => {
    const stored: DailyUsage = { day: '2026-10-19', count: 5 }
    expect(usageForToday(stored, at(2026, 10, 18))).toEqual({ day: '2026-10-18', count: 0 })
  })
})

describe('captureGate (free)', () => {
  const now = at(2026, 10, 18)

  it('allows captures with the full allowance on a fresh day', () => {
    expect(captureGate('free', null, now)).toEqual({ allowed: true, unlimited: false, remaining: 20, limit: 20, used: 0 })
  })

  it('counts down and allows the 20th capture', () => {
    expect(captureGate('free', { day: '2026-10-18', count: 19 }, now)).toMatchObject({ allowed: true, remaining: 1, used: 19 })
  })

  it('blocks once 20 are used', () => {
    expect(captureGate('free', { day: '2026-10-18', count: 20 }, now)).toEqual({
      allowed: false, unlimited: false, remaining: 0, limit: 20, used: 20, reason: 'daily-limit',
    })
  })

  it('stays blocked if the count somehow exceeds the limit', () => {
    expect(captureGate('free', { day: '2026-10-18', count: 35 }, now)).toMatchObject({ allowed: false, remaining: 0 })
  })

  it('allows captures again the next day', () => {
    expect(captureGate('free', { day: '2026-10-18', count: 20 }, at(2026, 10, 19, 0, 1))).toMatchObject({ allowed: true, remaining: 20, used: 0 })
  })
})

describe('captureGate (pro)', () => {
  it('never blocks', () => {
    const gate = captureGate('pro', { day: '2026-10-18', count: 5000 }, at(2026, 10, 18))
    expect(gate).toMatchObject({ allowed: true, unlimited: true, remaining: Infinity, limit: Infinity, used: 5000 })
  })
})

describe('recordCapture', () => {
  it('adds one to today', () => {
    expect(recordCapture({ day: '2026-10-18', count: 3 }, at(2026, 10, 18))).toEqual({ day: '2026-10-18', count: 4 })
  })

  it('starts a new day at one, and from nothing', () => {
    expect(recordCapture({ day: '2026-10-17', count: 20 }, at(2026, 10, 18))).toEqual({ day: '2026-10-18', count: 1 })
    expect(recordCapture(null, at(2026, 10, 18))).toEqual({ day: '2026-10-18', count: 1 })
  })

  it('does not change the usage it was given', () => {
    const stored = { day: '2026-10-18', count: 3 }
    recordCapture(stored, at(2026, 10, 18))
    expect(stored.count).toBe(3)
  })

  it('reaches the free limit after exactly 20 captures', () => {
    let usage: DailyUsage | null = null
    const now = at(2026, 10, 18)
    let taken = 0
    while (captureGate('free', usage, now).allowed) {
      usage = recordCapture(usage, now)
      taken++
    }
    expect(taken).toBe(20)
  })
})

describe('tryCapture', () => {
  const now = at(2026, 10, 18)

  it('counts a capture when allowed', () => {
    const r = tryCapture('free', { day: '2026-10-18', count: 3 }, now)
    expect(r.gate.allowed).toBe(true)
    expect(r.usage).toEqual({ day: '2026-10-18', count: 4 })
  })

  it('does not count when blocked', () => {
    const r = tryCapture('free', { day: '2026-10-18', count: 20 }, now)
    expect(r.gate).toMatchObject({ allowed: false, reason: 'daily-limit' })
    expect(r.usage).toEqual({ day: '2026-10-18', count: 20 })
  })

  it('lets exactly 20 captures through in a day, then blocks', () => {
    let usage: DailyUsage | null = null
    let allowed = 0
    for (let i = 0; i < 30; i++) {
      const r = tryCapture('free', usage, now)
      usage = r.usage
      if (r.gate.allowed) allowed++
    }
    expect(allowed).toBe(20)
  })

  it('on a new day counts from one', () => {
    const r = tryCapture('free', { day: '2026-10-17', count: 20 }, now)
    expect(r.gate.allowed).toBe(true)
    expect(r.usage).toEqual({ day: '2026-10-18', count: 1 })
  })

  it('counts on Pro too, without ever blocking', () => {
    const r = tryCapture('pro', { day: '2026-10-18', count: 500 }, now)
    expect(r.gate.allowed).toBe(true)
    expect(r.usage.count).toBe(501)
  })
})
