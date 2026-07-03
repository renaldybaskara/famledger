import { Platform } from 'react-native'
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
} from 'react-native-purchases'

// RevenueCat public API keys — safe to include in client code
const API_KEYS = {
  ios: 'test_PpsxWCFPfYmfWodOkdirQYrcgAs',
  android: 'test_PpsxWCFPfYmfWodOkdirQYrcgAs',
}

export const ENTITLEMENT_ID = 'MyBudgetin Pro'

export const PRODUCT_IDS = {
  monthly: 'monthly',
  yearly: 'yearly',
  lifetime: 'lifetime',
} as const

let configured = false

/**
 * Call once at app startup (after the user is authenticated).
 * Pass the Budgetin user UUID as appUserID so RevenueCat webhooks
 * can map purchases back to the correct backend user.
 */
export async function configurePurchases(userID: string): Promise<void> {
  if (Platform.OS === 'web') return // RevenueCat is native-only

  if (configured) {
    await Purchases.logIn(userID)
    return
  }

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG)
  }

  const apiKey = Platform.OS === 'ios' ? API_KEYS.ios : API_KEYS.android
  Purchases.configure({ apiKey, appUserID: userID })
  configured = true
}

/** Log out of RevenueCat (call on user logout). */
export async function logOutPurchases(): Promise<void> {
  if (Platform.OS === 'web' || !configured) return
  try {
    await Purchases.logOut()
  } catch {
    // no-op — user may already be anonymous
  }
}

/** Returns the current customer info, or null on web/error. */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (Platform.OS === 'web' || !configured) return null
  try {
    return await Purchases.getCustomerInfo()
  } catch {
    return null
  }
}

/** Returns true if the user has an active "MyBudgetin Pro" entitlement. */
export async function isProEntitlementActive(): Promise<boolean> {
  const info = await getCustomerInfo()
  if (!info) return false
  return info.entitlements.active[ENTITLEMENT_ID] !== undefined
}

/** Fetches the current offering to display in the paywall. */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (Platform.OS === 'web' || !configured) return null
  try {
    const offerings = await Purchases.getOfferings()
    return offerings.current ?? null
  } catch {
    return null
  }
}
