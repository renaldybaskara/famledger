import { Platform } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { subscriptionApi } from '../lib/api'
import { useAuthStore } from '../store/auth.store'
import { ENTITLEMENT_ID, getCustomerInfo, isProEntitlementActive } from '../lib/purchases'

// ── Backend status (drives TierGate on the server) ───────────────────────────
export function useSubscription() {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.getStatus().then((r) => r.data),
    staleTime: 0,
    refetchOnMount: true,
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

// ── RevenueCat customer info (native-only) ────────────────────────────────────
export function useRevenueCatCustomerInfo() {
  return useQuery({
    queryKey: ['revenuecat', 'customerInfo'],
    queryFn: getCustomerInfo,
    enabled: Platform.OS !== 'web',
    staleTime: 30_000,
  })
}

/** Returns true if the user has an active RevenueCat Pro entitlement (native only). */
export function useIsRevenueCatPro(): boolean {
  const { data } = useRevenueCatCustomerInfo()
  if (!data) return false
  return data.entitlements.active[ENTITLEMENT_ID] !== undefined
}

// ── Composite pro-active check ────────────────────────────────────────────────
// On native: prefer RevenueCat entitlement (real-time).
// On web: fall back to backend subscription status.
export function useIsProActive(): boolean {
  const rcPro = useIsRevenueCatPro()
  const { data: sub } = useSubscription()
  const userTier = useAuthStore((s) => s.user?.tier)

  if (Platform.OS !== 'web') return rcPro

  // user.tier='free' is the DB source of truth — always block if free
  if (userTier === 'free') return false
  if (!sub) return false
  const now = Date.now()
  switch (sub.status) {
    case 'trialing':
      return !!sub.trialEndsAt && new Date(sub.trialEndsAt).getTime() > now
    case 'active':
      return !sub.currentPeriodEnd || new Date(sub.currentPeriodEnd).getTime() > now
    case 'past_due':
      return !!sub.gracePeriodEndsAt && new Date(sub.gracePeriodEndsAt).getTime() > now
    default:
      return false
  }
}

// ── Trial days helper ─────────────────────────────────────────────────────────
export function useTrialDaysLeft(): number | null {
  const { data } = useSubscription()
  if (!data || data.status !== 'trialing' || !data.trialEndsAt) return null
  const ms = new Date(data.trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

// ── Midtrans web payment ──────────────────────────────────────────────────────
function loadSnapScript(clientKey: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(); return }
    if (document.getElementById('midtrans-snap')) { resolve(); return }
    const script = document.createElement('script')
    script.id = 'midtrans-snap'
    script.src = 'https://app.sandbox.midtrans.com/snap/snap.js'
    script.setAttribute('data-client-key', clientKey)
    script.onload = () => resolve()
    document.head.appendChild(script)
  })
}

export function useMidtransPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ period }: { period: 'monthly' | 'annual' | 'lifetime' }) => {
      const { data } = await subscriptionApi.createMidtransPayment({ plan: 'pro', period })
      const { snapToken, clientKey } = data
      await loadSnapScript(clientKey)
      return new Promise<void>((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const snap = (window as any).snap
        if (!snap) { reject(new Error('Snap.js not loaded')); return }
        snap.pay(snapToken, {
          onSuccess: async () => {
            try { await subscriptionApi.confirmMidtransPayment() } catch (_) { /* webhook will handle it */ }
            qc.invalidateQueries({ queryKey: ['subscription'] })
            resolve()
          },
          onPending: () => { qc.invalidateQueries({ queryKey: ['subscription'] }); resolve() },
          onError: (err: unknown) => reject(err),
          onClose: () => resolve(),
        })
      })
    },
  })
}

// ── Restore purchases (native only) ──────────────────────────────────────────
export function useRestorePurchases() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (Platform.OS === 'web') return null
      const Purchases = (await import('react-native-purchases')).default
      const info = await Purchases.restorePurchases()
      qc.invalidateQueries({ queryKey: ['revenuecat'] })
      qc.invalidateQueries({ queryKey: ['subscription'] })
      return info
    },
  })
}

// ── Check entitlement directly (one-shot) ────────────────────────────────────
export { isProEntitlementActive }
