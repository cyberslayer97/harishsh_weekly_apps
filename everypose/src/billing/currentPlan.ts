import type { Plan } from './plans'

/**
 * The plan the user is on. Always free until purchases are wired in; set
 * EXPO_PUBLIC_PLAN=pro when starting the app to try the Pro behaviour.
 */
export function useCurrentPlan(): Plan {
  return process.env.EXPO_PUBLIC_PLAN === 'pro' ? 'pro' : 'free'
}
