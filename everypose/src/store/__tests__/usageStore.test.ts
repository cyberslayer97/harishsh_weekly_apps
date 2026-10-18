import { createUsageRepo, type KeyValueStorage } from '../../billing/usageRepo'
import { createUsageStore } from '../createUsageStore'

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial }
  return { data, getItem: async (k) => data[k] ?? null, setItem: async (k, v) => { data[k] = v } }
}

const day = (d: number, h = 12) => new Date(2026, 9, d, h)

describe('usage store', () => {
  it('starts with a full allowance and counts captures', () => {
    const store = createUsageStore(createUsageRepo(memoryStorage()), () => day(18))
    expect(store.getState().gate('free')).toMatchObject({ allowed: true, remaining: 20 })
    store.getState().record()
    store.getState().record()
    expect(store.getState().gate('free')).toMatchObject({ remaining: 18, used: 2 })
  })

  it('blocks free users after 20 and never blocks Pro', () => {
    const store = createUsageStore(createUsageRepo(memoryStorage()), () => day(18))
    for (let i = 0; i < 20; i++) store.getState().record()
    expect(store.getState().gate('free')).toMatchObject({ allowed: false, reason: 'daily-limit' })
    expect(store.getState().gate('pro').allowed).toBe(true)
  })

  it('saves after each capture and restores on the next start', async () => {
    const storage = memoryStorage()
    const first = createUsageStore(createUsageRepo(storage), () => day(18))
    await first.getState().load()
    first.getState().record()
    first.getState().record()
    await Promise.resolve()
    const second = createUsageStore(createUsageRepo(storage), () => day(18))
    await second.getState().load()
    expect(second.getState().loaded).toBe(true)
    expect(second.getState().gate('free')).toMatchObject({ used: 2, remaining: 18 })
  })

  it('starts a new day with a fresh allowance', async () => {
    const storage = memoryStorage()
    const today = createUsageStore(createUsageRepo(storage), () => day(18))
    await today.getState().load()
    for (let i = 0; i < 20; i++) today.getState().record()
    await Promise.resolve()
    const tomorrow = createUsageStore(createUsageRepo(storage), () => day(19, 0))
    await tomorrow.getState().load()
    expect(tomorrow.getState().gate('free')).toMatchObject({ allowed: true, remaining: 20 })
  })

  it('loads only once, so a remount cannot double-count', async () => {
    const storage = memoryStorage({ 'everypose.usage.v1': JSON.stringify({ day: '2026-10-18', count: 5 }) })
    const store = createUsageStore(createUsageRepo(storage), () => day(18))
    await Promise.all([store.getState().load(), store.getState().load()])
    await store.getState().load()
    expect(store.getState().usage).toEqual({ day: '2026-10-18', count: 5 })
  })

  it('does not overwrite the saved count with a capture recorded before it loaded', async () => {
    const storage = memoryStorage({ 'everypose.usage.v1': JSON.stringify({ day: '2026-10-18', count: 5 }) })
    const store = createUsageStore(createUsageRepo(storage), () => day(18))
    store.getState().record()
    await store.getState().load()
    expect(store.getState().usage).toEqual({ day: '2026-10-18', count: 6 })
    await Promise.resolve()
    expect(JSON.parse(storage.data['everypose.usage.v1'])).toEqual({ day: '2026-10-18', count: 6 })
  })
})
