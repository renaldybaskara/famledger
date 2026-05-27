import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '../lib/api'
import { getCurrentMonthRange } from '../lib/format'

export function useDashboardSummary(params?: { startDate?: string; endDate?: string }) {
  const range = params ?? getCurrentMonthRange()
  return useQuery({
    queryKey: ['dashboard', 'summary', range],
    queryFn: () => dashboardApi.summary(range).then((r) => r.data),
    staleTime: 30_000,
  })
}

export function useCategoryBreakdown(params?: {
  startDate?: string
  endDate?: string
  type?: string
}) {
  const range = params ?? { ...getCurrentMonthRange(), type: 'expense' }
  return useQuery({
    queryKey: ['dashboard', 'category-breakdown', range],
    queryFn: () => dashboardApi.categoryBreakdown(range).then((r) => r.data),
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
