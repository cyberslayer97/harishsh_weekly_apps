import AsyncStorage from '@react-native-async-storage/async-storage'
import { useStore } from 'zustand'
import { createUsageRepo } from '../billing/usageRepo'
import { createUsageStore, type UsageState } from './createUsageStore'

export const usageStore = createUsageStore(createUsageRepo(AsyncStorage))

export function useUsage<T>(selector: (state: UsageState) => T): T {
  return useStore(usageStore, selector)
}
