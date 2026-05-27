export const TIER_LIMITS = {
  free: {
    transactions: 100,
    budgets: 2,
    subscriptions: 3,
    emailIntegrations: 1,
    customRules: 0,
    exportEnabled: false,
    llmEnabled: false,
  },
  premium: {
    transactions: Infinity,
    budgets: Infinity,
    subscriptions: Infinity,
    emailIntegrations: 3,
    customRules: 10,
    exportEnabled: true,
    llmEnabled: true,
  },
  family: {
    transactions: Infinity,
    budgets: Infinity,
    subscriptions: Infinity,
    emailIntegrations: 6,
    customRules: 25,
    exportEnabled: true,
    llmEnabled: true,
  },
  business: {
    transactions: Infinity,
    budgets: Infinity,
    subscriptions: Infinity,
    emailIntegrations: 15,
    customRules: Infinity,
    exportEnabled: true,
    llmEnabled: true,
  },
} as const

export const APP_NAME = 'FinTrackr'
export const APP_VERSION = '0.1.0'
export const DEFAULT_CURRENCY = 'IDR'
export const DEFAULT_TIMEZONE = 'Asia/Jakarta'
export const DEFAULT_LOCALE = 'id-ID'
