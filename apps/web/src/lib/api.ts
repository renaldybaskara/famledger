import axios from 'axios'
import { useAuthStore } from '../store/auth.store'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api'

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

// Response interceptor: auto refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const { refreshToken, setAccessToken, logout } = useAuthStore.getState()
      if (!refreshToken) {
        logout()
        return Promise.reject(error)
      }

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        })
        setAccessToken(data.accessToken)
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return api(original)
      } catch {
        logout()
        return Promise.reject(error)
      }
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
  type: 'cash' | 'bank' | 'ewallet' | 'credit'
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
  summary: (params?: { startDate?: string; endDate?: string }) =>
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

export const accountsApi = {
  list: () => api.get<Account[]>('/accounts'),
  create: (data: {
    name: string
    type: 'cash' | 'bank' | 'ewallet' | 'credit'
    balance?: number
    currency?: string
    color?: string
    icon?: string
  }) => api.post<Account>('/accounts', data),
}
