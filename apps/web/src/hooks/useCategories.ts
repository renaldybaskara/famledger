import { useQuery } from '@tanstack/react-query'
import { categoriesApi } from '../lib/api'

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data),
    staleTime: 5 * 60_000, // 5 minutes — categories rarely change
  })
}
