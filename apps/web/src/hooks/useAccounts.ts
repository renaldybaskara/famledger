import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { accountsApi } from '../lib/api'

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.list().then((r) => r.data),
    staleTime: 60_000,
  })
}

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: accountsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}
