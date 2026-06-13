import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { subscriptionApi } from '../lib/api'

export function useSubscription() {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.getStatus().then((r) => r.data),
    staleTime: 60_000,
  })
}

export function useSubscriptionHistory() {
  return useQuery({
    queryKey: ['subscription', 'history'],
    queryFn: () => subscriptionApi.getHistory().then((r) => r.data),
    staleTime: 60_000,
  })
}

export function useCheckout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { plan: 'pro'; period: 'monthly' | 'annual' }) =>
      subscriptionApi.checkout(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription'] })
    },
  })
}

export function useCancelSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => subscriptionApi.cancel(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription'] })
    },
  })
}

// Helper — returns days left in trial, or null if not trialing
export function useTrialDaysLeft(): number | null {
  const { data } = useSubscription()
  if (!data || data.status !== 'trialing' || !data.trialEndsAt) return null
  const ms = new Date(data.trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

export function useIsProActive(): boolean {
  const { data } = useSubscription()
  if (!data) return false
  const now = Date.now()
  switch (data.status) {
    case 'trialing':
      return !!data.trialEndsAt && new Date(data.trialEndsAt).getTime() > now
    case 'active':
      return !data.currentPeriodEnd || new Date(data.currentPeriodEnd).getTime() > now
    case 'past_due':
      return !!data.gracePeriodEndsAt && new Date(data.gracePeriodEndsAt).getTime() > now
    default:
      return false
  }
}
