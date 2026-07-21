import { api } from './api'

// --- Types ---

export interface SavingsGoalSource {
  id: string
  goalId: string
  sourceType: 'saving_account' | 'stocks' | 'gold' | 'crypto' | 'reksadana' | 'deposit' | 'cash' | 'other'
  sourceName: string
  trackingMode: 'auto' | 'manual'
  accountId?: string
  currentAmount: number
  account?: {
    id: string
    name: string
    type: string
    accountNumber?: string
  }
  createdAt: string
  updatedAt: string
}

export interface SavingsGoalContribution {
  id: string
  goalId: string
  sourceId: string
  userId: string
  transactionId?: string
  amount: number
  type: 'manual' | 'auto' | 'withdraw'
  note?: string
  contributedAt: string
  createdAt: string
  source?: SavingsGoalSource
  user?: {
    id: string
    name: string
    email: string
  }
}

export interface SavingsGoal {
  id: string
  userId: string
  workspaceId?: string
  name: string
  description?: string
  targetAmount: number
  currentAmount: number
  currency: string
  icon: string
  color: string
  deadline?: string
  status: 'active' | 'achieved' | 'paused' | 'cancelled'
  achievedAt?: string
  sources: SavingsGoalSource[]
  createdAt: string
  updatedAt: string
}

export interface SavingsGoalSummary {
  totalGoals: number
  onTrack: number
  behind: number
  totalTarget: number
  totalCurrent: number
  overallPercent: number
  totalSavingAccount: number
  totalStocks: number
  totalGold: number
  totalReksadana: number
  totalCrypto: number
  totalDeposit: number
  totalCash: number
  totalOther: number
}

export interface SavingsGoalAllocation {
  id: string
  accountId: string
  goalId: string
  sourceId: string
  percentage: number
}

// --- Input Types ---

export interface CreateGoalInput {
  workspaceId?: string
  name: string
  description?: string
  targetAmount: number
  currency?: string
  icon?: string
  color?: string
  deadline?: string
  sources?: AddSourceInput[]
}

export interface UpdateGoalInput {
  name?: string
  description?: string
  targetAmount?: number
  icon?: string
  color?: string
  deadline?: string
}

export interface AddSourceInput {
  sourceType: SavingsGoalSource['sourceType']
  sourceName: string
  trackingMode?: 'auto' | 'manual'
  accountId?: string
}

export interface UpdateSourceInput {
  sourceName?: string
  trackingMode?: 'auto' | 'manual'
  accountId?: string
}

export interface AddContributionInput {
  sourceId: string
  amount: number
  type: 'manual' | 'withdraw'
  note?: string
  contributedAt?: string
}

export interface SetAllocationInput {
  accountId: string
  goalId: string
  sourceId: string
  percentage: number
}

// --- API Service ---
// All data comes from the backend. No client-side calculations.

export const savingsGoalsApi = {
  // Goals CRUD
  list: (params?: { status?: string; workspaceId?: string }) =>
    api.get<SavingsGoal[]>('/savings-goals', { params }),

  get: (id: string) =>
    api.get<SavingsGoal>(`/savings-goals/${id}`),

  create: (data: CreateGoalInput) =>
    api.post<SavingsGoal>('/savings-goals', data),

  update: (id: string, data: UpdateGoalInput) =>
    api.patch<SavingsGoal>(`/savings-goals/${id}`, data),

  delete: (id: string) =>
    api.delete(`/savings-goals/${id}`),

  updateStatus: (id: string, status: string) =>
    api.patch(`/savings-goals/${id}/status`, { status }),

  // Sources
  listSources: (goalId: string) =>
    api.get<SavingsGoalSource[]>(`/savings-goals/${goalId}/sources`),

  addSource: (goalId: string, data: AddSourceInput) =>
    api.post<SavingsGoalSource>(`/savings-goals/${goalId}/sources`, data),

  updateSource: (goalId: string, sourceId: string, data: UpdateSourceInput) =>
    api.patch<SavingsGoalSource>(`/savings-goals/${goalId}/sources/${sourceId}`, data),

  deleteSource: (goalId: string, sourceId: string) =>
    api.delete(`/savings-goals/${goalId}/sources/${sourceId}`),

  // Contributions
  listContributions: (goalId: string, params?: { type?: string; page?: number; limit?: number }) =>
    api.get<{ data: SavingsGoalContribution[]; total: number; page: number; limit: number }>(
      `/savings-goals/${goalId}/contributions`, { params }
    ),

  addContribution: (goalId: string, data: AddContributionInput) =>
    api.post<SavingsGoalContribution>(`/savings-goals/${goalId}/contributions`, data),

  // Allocations
  getAllocations: () =>
    api.get<SavingsGoalAllocation[]>('/savings-goals/allocations'),

  setAllocations: (data: SetAllocationInput[]) =>
    api.put('/savings-goals/allocations', data),

  // Summary (for dashboard widget)
  // All calculations done server-side — returns pre-computed totals
  getSummary: () =>
    api.get<SavingsGoalSummary>('/savings-goals/summary'),
}

// --- Source Type Helpers (display only, no calculations) ---

export const SOURCE_TYPE_CONFIG = {
  saving_account: { icon: '💰', label: 'Tabungan', canAuto: true },
  stocks: { icon: '📈', label: 'Saham', canAuto: false },
  gold: { icon: '🪙', label: 'Emas', canAuto: false },
  reksadana: { icon: '📊', label: 'Reksadana', canAuto: false },
  crypto: { icon: '₿', label: 'Crypto', canAuto: false },
  deposit: { icon: '🏦', label: 'Deposito', canAuto: false },
  cash: { icon: '💵', label: 'Tunai', canAuto: false },
  other: { icon: '📦', label: 'Lainnya', canAuto: false },
} as const

export type SourceType = keyof typeof SOURCE_TYPE_CONFIG
