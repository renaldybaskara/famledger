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

export function useMonthlyTrend(months = 6) {
  return useQuery({
    queryKey: ['dashboard', 'monthly-trend', months],
    queryFn: () => dashboardApi.monthlyTrend({ months }).then((r) => r.data),
    staleTime: 60_000,
  })
}
