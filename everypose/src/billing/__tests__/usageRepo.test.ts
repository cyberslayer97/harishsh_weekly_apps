import { USAGE_STORAGE_KEY, createUsageRepo, type KeyValueStorage } from '../usageRepo'

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: async (k) => (k in data ? data[k] : null),
    setItem: async (k, v) => { data[k] = v },
  }
}

describe('usage repo', () => {
  it('returns null on first run', async () => {
    expect(await createUsageRepo(memoryStorage()).load()).toBeNull()
  })

  it('saves and loads usage', async () => {
    const repo = createUsageRepo(memoryStorage())
    await repo.save({ day: '2026-10-18', count: 4 })
    expect(await repo.load()).toEqual({ day: '2026-10-18', count: 4 })
  })

  it.each([
    ['not JSON', '{oops'],
    ['wrong shape', JSON.stringify({ hello: 1 })],
    ['negative count', JSON.stringify({ day: '2026-10-18', count: -3 })],
    ['fractional count', JSON.stringify({ day: '2026-10-18', count: 1.5 })],
    ['string count', JSON.stringify({ day: '2026-10-18', count: '4' })],
    ['bad day', JSON.stringify({ day: 'yesterday', count: 1 })],
    ['impossible date', JSON.stringify({ day: '2026-02-31', count: 1 })],
    ['month 13', JSON.stringify({ day: '2026-13-01', count: 1 })],
    ['huge count', JSON.stringify({ day: '2026-10-18', count: 1e308 })],
    ['null', 'null'],
  ])('treats damaged data (%s) as no usage', async (_name, raw) => {
    expect(await createUsageRepo(memoryStorage({ [USAGE_STORAGE_KEY]: raw })).load()).toBeNull()
  })

  it('accepts a real leap day', async () => {
    const repo = createUsageRepo(memoryStorage())
    await repo.save({ day: '2028-02-29', count: 2 })
    expect(await repo.load()).toEqual({ day: '2028-02-29', count: 2 })
  })

  it('reports whether a save worked instead of throwing', async () => {
    const broken: KeyValueStorage = { getItem: async () => null, setItem: async () => { throw new Error('full') } }
    expect(await createUsageRepo(broken).save({ day: '2026-10-18', count: 1 })).toBe(false)
    expect(await createUsageRepo(memoryStorage()).save({ day: '2026-10-18', count: 1 })).toBe(true)
  })

  it('treats a storage failure as no usage', async () => {
    const broken: KeyValueStorage = { getItem: async () => { throw new Error('disk') }, setItem: async () => {} }
    expect(await createUsageRepo(broken).load()).toBeNull()
  })
})
