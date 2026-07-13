import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '../lib/api'
import { getCurrentMonthRange } from '../lib/format'

interface DashboardScope {
  workspaceIds?: string[]
  includePersonal?: boolean
}

export function useDashboardSummary(params?: { startDate?: string; endDate?: string } & DashboardScope) {
  const { workspaceIds, includePersonal, ...dateParams } = params ?? {}
  const range = Object.keys(dateParams).length ? dateParams : getCurrentMonthRange()
  return useQuery({
    queryKey: ['dashboard', 'summary', range, workspaceIds, includePersonal],
    queryFn: () => dashboardApi.summary({ ...range, workspaceIds, includePersonal }).then((r) => r.data),
    staleTime: 30_000,
  })
}

export function useCategoryBreakdown(params?: {
  startDate?: string
  endDate?: string
  type?: string
} & DashboardScope) {
  const { workspaceIds, includePersonal, ...rest } = params ?? {}
  const range = Object.keys(rest).length ? rest : { ...getCurrentMonthRange(), type: 'expense' }
  return useQuery({
    queryKey: ['dashboard', 'category-breakdown', range, workspaceIds, includePersonal],
    queryFn: () => dashboardApi.categoryBreakdown({ ...range, workspaceIds, includePersonal }).then((r) => r.data),
    staleTime: 30_000,
  })
}

export function useMonthlyTrend(params: number | { startDate: string; endDate: string } = 6) {
  // Backward-compat: if a number is passed, use months param (existing behavior).
  // If an object with startDate/endDate is passed, use date range (payday filter).
  const queryParams = typeof params === 'number'
    ? { months: params }
    : { startDate: params.startDate, endDate: params.endDate }

  return useQuery({
    queryKey: ['dashboard', 'monthly-trend', queryParams],
    queryFn: () => dashboardApi.monthlyTrend(queryParams).then((r) => r.data),
    staleTime: 60_000,
  })
}

export function usePaydayTrend(paydayDate: number, cycles = 6, scope?: DashboardScope) {
  return useQuery({
    queryKey: ['dashboard', 'payday-trend', paydayDate, cycles, scope],
    queryFn: () => dashboardApi.paydayTrend({
      paydayDate,
      cycles,
      ...scope,
    }).then((r) => r.data),
    staleTime: 60_000,
  })
}

export function useDailyActivity(params?: { startDate?: string; endDate?: string } & DashboardScope) {
  const { workspaceIds, includePersonal, ...dateParams } = params ?? {}
  const range = Object.keys(dateParams).length ? dateParams : getCurrentMonthRange()
  return useQuery({
    queryKey: ['dashboard', 'daily-activity', range, workspaceIds, includePersonal],
    queryFn: () => dashboardApi.dailyActivity({ ...range, workspaceIds, includePersonal }).then((r) => r.data),
    staleTime: 30_000,
  })
}
