import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi, BankParserRule } from '../lib/api'

// ── SMTP ─────────────────────────────────────────────────────────────────────

export function useSmtpConfig() {
  return useQuery({
    queryKey: ['settings', 'smtp'],
    queryFn: () => settingsApi.getSmtp().then((r) => r.data),
    staleTime: 60_000,
  })
}

export function useUpdateSmtpConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: settingsApi.saveSmtp,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'smtp'] })
    },
  })
}

export function useTestSmtp() {
  return useMutation({
    mutationFn: (email: string) => settingsApi.testSmtp(email),
  })
}

// ── Parser Rules ─────────────────────────────────────────────────────────────

export function useParserRules() {
  return useQuery({
    queryKey: ['settings', 'parser-rules'],
    queryFn: () => settingsApi.listParserRules().then((r) => r.data),
    staleTime: 30_000,
  })
}

export function useCreateParserRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (d: Partial<BankParserRule>) => settingsApi.createParserRule(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'parser-rules'] })
    },
  })
}

export function useToggleParserRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => settingsApi.toggleParserRule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'parser-rules'] })
    },
  })
}

export function useDeleteParserRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => settingsApi.deleteParserRule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'parser-rules'] })
    },
  })
}
