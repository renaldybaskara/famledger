export type UserTier = 'free' | 'premium' | 'family' | 'business'
export type TransactionType = 'income' | 'expense' | 'transfer'
export type AccountType = 'bank' | 'ewallet' | 'cash' | 'credit_card' | 'investment'

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ApiResponse<T = unknown> {
  data?: T
  message?: string
  error?: string
}

// Indonesian Bank Codes
export const BANK_CODES = {
  BCA: 'BCA',
  MANDIRI: 'Mandiri',
  BRI: 'BRI',
  BNI: 'BNI',
  CIMB: 'CIMB Niaga',
  PERMATA: 'Bank Permata',
  DANAMON: 'Bank Danamon',
  BTN: 'BTN',
  OCBC: 'OCBC NISP',
} as const

// Indonesian E-wallets
export const EWALLETS = {
  GOPAY: 'GoPay',
  OVO: 'OVO',
  DANA: 'DANA',
  SHOPEEPAY: 'ShopeePay',
  LINKAJA: 'LinkAja',
} as const
