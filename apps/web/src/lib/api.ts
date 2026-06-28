import axios from 'axios'
import { router } from 'expo-router'
import { useAuthStore } from '../store/auth.store'

const API_URL = process.env.EXPO_PUBLIC_API_URL || '/api'

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// Request interceptor: attach access token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response interceptor: auto refresh on 401, redirect to login on failure
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const { refreshToken, setAccessToken, logout } = useAuthStore.getState()

      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken })
          setAccessToken(data.accessToken)
          original.headers.Authorization = `Bearer ${data.accessToken}`
          return api(original)
        } catch {
          // refresh failed — fall through to logout
        }
      }

      // Clear session and redirect to login
      logout()
      router.replace('/(auth)/login' as any)
      return Promise.reject(error)
    }
    return Promise.reject(error)
  }
)

// API helpers
export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
  me: () => api.get('/auth/me'),
}

export type TransactionType = 'income' | 'expense' | 'transfer'

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  note?: string
  merchant?: string
  categoryId: string
  category?: {
    id: string
    name: string
    icon: string
    color: string
  }
  accountId: string
  account?: {
    id: string
    name: string
  }
  date: string
  createdAt: string
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  type: TransactionType
}

export interface Budget {
  id: string
  name: string
  amount: number
  spent: number
  categoryId?: string
  category?: Category
  period: 'monthly' | 'weekly' | 'yearly'
  startDate: string
  endDate: string
}

export interface Account {
  id: string
  name: string
  type: 'bank' | 'credit' | 'investment'
  balance: number
  currency: string
  color: string
  icon: string
}

export const transactionsApi = {
  list: (params?: {
    page?: number
    limit?: number
    type?: string
    startDate?: string
    endDate?: string
    categoryId?: string
    search?: string
  }) => api.get<{ data: Transaction[]; total: number; page: number; limit: number }>('/transactions', { params }),
  create: (data: {
    type: TransactionType
    amount: number
    note?: string
    merchant?: string
    categoryId: string
    accountId: string
    date: string
  }) => api.post<Transaction>('/transactions', data),
  update: (id: string, data: Partial<Transaction>) =>
    api.patch<Transaction>(`/transactions/${id}`, data),
  delete: (id: string) => api.delete(`/transactions/${id}`),
}

export const dashboardApi = {
  summary: (params?: { startDate?: string; endDate?: string; workspaceIds?: string[]; includePersonal?: boolean }) =>
    api.get<{
      totalIncome: number
      totalExpense: number
      netBalance: number
      transactionCount: number
    }>('/dashboard/summary', { params }),
  categoryBreakdown: (params?: {
    startDate?: string
    endDate?: string
    type?: string
    workspaceIds?: string[]
    includePersonal?: boolean
  }) =>
    api.get<
      Array<{
        categoryId: string
        categoryName: string
        categoryColor: string
        categoryIcon: string
        total: number
        percentage: number
      }>
    >('/dashboard/category-breakdown', { params }),
  monthlyTrend: (params?: { months?: number }) =>
    api.get<
      Array<{
        month: string
        income: number
        expense: number
      }>
    >('/dashboard/monthly-trend', { params }),
}

export const categoriesApi = {
  list: () => api.get<Category[]>('/categories'),
  create: (data: { name: string; icon: string; color: string; type: TransactionType }) =>
    api.post<Category>('/categories', data),
  update: (id: string, data: { name?: string; icon?: string; color?: string }) =>
    api.patch<Category>(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
}

export const budgetsApi = {
  list: () => api.get<Budget[]>('/budgets'),
  create: (data: {
    name: string
    amount: number
    categoryId?: string
    period: 'monthly' | 'weekly' | 'yearly'
    startDate: string
    endDate: string
  }) => api.post<Budget>('/budgets', data),
  update: (id: string, data: Partial<Budget>) =>
    api.patch<Budget>(`/budgets/${id}`, data),
  delete: (id: string) => api.delete(`/budgets/${id}`),
}

export interface SmtpConfig {
  host: string
  port: string
  user: string
  from: string
  enabled: boolean
}

export interface BankParserRule {
  id: number
  name: string
  fromPatterns: string
  subjectPatterns: string
  expenseKeywords: string
  incomeKeywords: string
  bodyConfirmKeywords: string
  amountRegex: string
  defaultType: 'expense' | 'income'
  priority: number
  isActive: boolean
  isGlobal: boolean
  note: string
  createdAt: string
  updatedAt: string
}

export const settingsApi = {
  getSmtp: () =>
    api.get<SmtpConfig>('/settings/smtp'),
  saveSmtp: (d: { host: string; port: string; user: string; pass?: string; from: string; enabled: boolean }) =>
    api.put('/settings/smtp', d),
  testSmtp: (email: string) =>
    api.post('/settings/smtp/test', { email }),
  listParserRules: () =>
    api.get<BankParserRule[]>('/settings/parser-rules'),
  createParserRule: (d: Partial<BankParserRule>) =>
    api.post<BankParserRule>('/settings/parser-rules', d),
  updateParserRule: (id: number, d: Partial<BankParserRule>) =>
    api.patch<BankParserRule>(`/settings/parser-rules/${id}`, d),
  toggleParserRule: (id: number) =>
    api.patch<BankParserRule>(`/settings/parser-rules/${id}/toggle`),
  deleteParserRule: (id: number) =>
    api.delete(`/settings/parser-rules/${id}`),
}

export interface ParsedSlip {
  amount: number
  merchant: string
  date: string | null
  bank: string
  type: 'expense' | 'income' | ''
  accountNumber: string
  rawText: string
  confidence: number
}

export const paymentSlipsApi = {
  scan: (formData: FormData) =>
    api.post<ParsedSlip>('/payment-slips/scan', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    }),
}

// ── Subscription ─────────────────────────────────────────────
export interface UserSubscription {
  id: string
  userId: string
  plan: 'free' | 'pro'
  period: 'monthly' | 'annual' | 'lifetime' | ''
  status: 'free' | 'trialing' | 'active' | 'past_due' | 'canceled'
  trialEligible: boolean   // true only when no subscription row exists yet (never interacted with trial)
  trialEndsAt?: string
  currentPeriodStart?: string
  currentPeriodEnd?: string
  canceledAt?: string
  gracePeriodEndsAt?: string
  productId?: string
}

export const subscriptionApi = {
  getStatus: () =>
    api.get<UserSubscription>('/subscription'),
  startTrial: () =>
    api.post('/subscription/start-trial'),
  cancel: () =>
    api.post('/subscription/cancel'),
  createMidtransPayment: (body: { plan: string; period: string }) =>
    api.post<{ snapToken: string; clientKey: string; orderId: string }>('/subscription/midtrans/create-payment', body),
  confirmMidtransPayment: () =>
    api.post('/subscription/midtrans/confirm'),
}

export const accountsApi = {
  list: () => api.get<Account[]>('/accounts'),
  create: (data: {
    name: string
    type: 'cash' | 'bank' | 'ewallet' | 'credit'
    balance?: number
    currency?: string
    color?: string
    icon?: string
    bankCode?: string
    accountNumber?: string
    isDefault?: boolean
  }) => api.post<Account>('/accounts', data),
  update: (id: string, data: {
    name?: string
    type?: string
    balance?: number
    color?: string
    icon?: string
    bankCode?: string
    accountNumber?: string
    isDefault?: boolean
    isActive?: boolean
  }) => api.patch<Account>(`/accounts/${id}`, data),
  delete: (id: string) => api.delete(`/accounts/${id}`),
}
