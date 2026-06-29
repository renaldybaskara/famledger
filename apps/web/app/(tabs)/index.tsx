import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  View, Text, ScrollView, RefreshControl,
  TouchableOpacity, Platform, Modal, Pressable, Alert,
} from 'react-native'
import { Mail, X, Zap, ChevronRight } from 'lucide-react'
import * as WebBrowser from 'expo-web-browser'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useDashboardSummary, useCategoryBreakdown, useMonthlyTrend, usePaydayTrend } from '../../src/hooks/useDashboard'
import { useTransactions } from '../../src/hooks/useTransactions'
import { useAuthStore } from '../../src/store/auth.store'
import { useIsProActive } from '../../src/hooks/useSubscription'
import { api } from '../../src/lib/api'
import { formatCurrency, formatCurrencyCompact } from '../../src/lib/format'
import { TransactionItem } from '../../components/transactions/TransactionItem'
import { TransactionDetailModal } from '../../components/transactions/TransactionDetailModal'
import { AddTransactionModal } from '../../components/transactions/AddTransactionModal'
import { PaymentSlipScanModal } from '../../components/transactions/PaymentSlipScanModal'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { PeriodModal, getPresetRange, type Preset } from '../../components/ui/PeriodModal'

// ── Saku design tokens ────────────────────────────────────────
const C = {
  heroStart:    '#6B8E6B',
  heroEnd:      '#41594F',
  accent:       '#C97B5C',
  accentSoft:   '#F4DDD0',
  cream:        '#FAF7F2',
  creamSunken:  '#F4EEE3',
  surface:      '#FFFFFF',
  primary:      '#6B8E6B',
  primaryDeep:  '#3D7A56',
  expenseDeep:  '#D4704A',
  primarySoft:  '#DEE8D7',
  incomeSoft:   '#DEE8D7',
  expenseSoft:  '#F4DDD0',
  savingSoft:   '#FBEFD2',
  fg1:          '#2D2A26',
  fg1d:         '#1A2820',
  fg2:          '#55504A',
  fg3:          '#8E887F',
  fg4:          '#A8A39B',
  border:       '#E0DBD2',
  divider:      '#ECE4D3',
  mustard:      '#D9A441',
}

// ── Category progress row ─────────────────────────────────────
function CategoryRow({ name, amount, color, pct }: { name: string; amount: number; color: string; pct: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color }} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.fg1, fontFamily: 'Nunito_700Bold' }}>{name}</Text>
          <Text style={{ fontSize: 13, fontWeight: '800', color: C.fg1, fontFamily: 'Nunito_800ExtraBold', fontVariant: ['tabular-nums'] as any }}>{formatCurrencyCompact(amount)}</Text>
        </View>
        <View style={{ height: 6, borderRadius: 999, backgroundColor: C.creamSunken, overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(pct, 100)}%` as any, height: '100%', backgroundColor: color, borderRadius: 999 }} />
        </View>
      </View>
    </View>
  )
}

// ── Custom vertical bar chart ─────────────────────────────────
function TrendBarChart({ data }: { data: { label: string; income: number; expense: number }[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expense]), 1)
  const chartH = 100
  const lastIdx = data.length - 1

  return (
    <View>
      {/* Tooltip area */}
      {hoveredIdx !== null && (
        <View style={{
          backgroundColor: C.fg1d, borderRadius: 10, padding: 10, marginBottom: 10,
          flexDirection: 'row', justifyContent: 'space-between', gap: 16,
        }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff', fontFamily: 'Nunito_700Bold' }}>
            {data[hoveredIdx]?.label}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 2, backgroundColor: C.primaryDeep }} />
              <Text style={{ fontSize: 11, color: '#fff', fontFamily: 'Nunito_600SemiBold' }}>
                {formatCurrencyCompact(data[hoveredIdx]?.income ?? 0)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 2, backgroundColor: C.expenseDeep }} />
              <Text style={{ fontSize: 11, color: '#fff', fontFamily: 'Nunito_600SemiBold' }}>
                {formatCurrencyCompact(data[hoveredIdx]?.expense ?? 0)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Bars row */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartH, gap: 16, paddingHorizontal: 4 }}>
        {data.map((item, idx) => {
          const isCurrent = idx === lastIdx
          const incH = Math.max(Math.round((item.income / maxVal) * chartH), 3)
          const expH = Math.max(Math.round((item.expense / maxVal) * chartH), 3)
          const incColor = isCurrent ? C.primaryDeep : C.primaryDeep + '55'
          const expColor = isCurrent ? C.expenseDeep : C.expenseDeep + '55'

          const hoverProps = Platform.OS === 'web' ? {
            onMouseEnter: () => setHoveredIdx(idx),
            onMouseLeave: () => setHoveredIdx(null),
          } : {}

          return (
            <View
              key={item.label}
              style={{ width: 28, alignItems: 'center', gap: 6 }}
              {...(hoverProps as any)}
            >
              {/* Fixed-height bar container — income left, expense right, side by side */}
              <View style={{ width: 28, height: chartH, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                {/* Income bar */}
                <View style={{
                  flex: 1, height: incH, backgroundColor: incColor,
                  borderTopLeftRadius: 3, borderTopRightRadius: 3,
                }} />
                {/* Expense bar */}
                <View style={{
                  flex: 1, height: expH, backgroundColor: expColor,
                  borderTopLeftRadius: 3, borderTopRightRadius: 3,
                }} />
              </View>
              {/* Month label */}
              <Text style={{
                fontSize: 10, fontWeight: isCurrent ? '800' : '600',
                color: isCurrent ? C.fg1d : '#9DB5A8',
                fontFamily: isCurrent ? 'Nunito_800ExtraBold' : 'Nunito_600SemiBold',
              }}>
                {item.label}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

// ── Lainnya bottom sheet ──────────────────────────────────────
function LainnyaSheet({ visible, onClose, onAdd, onScan }: {
  visible: boolean; onClose: () => void; onAdd: () => void; onScan: () => void
}) {
  const isPro = useIsProActive()

  const proGate = (action: () => void) => () => {
    action()
  }

  const items = [
    { label: 'Tambah\nTransaksi', bg: '#DEE8D7', action: () => { onClose(); onAdd() },
      icon: <svg width="22" height="22" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" stroke={C.primaryDeep} strokeWidth="2.5" strokeLinecap="round" /><line x1="5" y1="12" x2="19" y2="12" stroke={C.primaryDeep} strokeWidth="2.5" strokeLinecap="round" /></svg> },
    { label: 'Scan\nStruk', bg: '#DDEEF7', action: () => { onClose(); onScan() },
      icon: <svg width="22" height="22" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="18" rx="2" fill="none" stroke="#2B7A9E" strokeWidth="1.8" /><line x1="8" y1="7" x2="16" y2="7" stroke="#2B7A9E" strokeWidth="1.5" strokeLinecap="round" /><line x1="8" y1="10.5" x2="16" y2="10.5" stroke="#2B7A9E" strokeWidth="1.5" strokeLinecap="round" /><line x1="8" y1="14" x2="12" y2="14" stroke="#2B7A9E" strokeWidth="1.5" strokeLinecap="round" /></svg> },
    { label: 'Transaksi', bg: '#F4EEE3', action: () => { onClose(); router.push('/(tabs)/transactions') },
      icon: <svg width="22" height="22" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke={C.fg2} strokeWidth="1.8" /><line x1="2" y1="10" x2="22" y2="10" stroke={C.fg2} strokeWidth="1.8" strokeLinecap="round" /></svg> },
    { label: 'Budget', bg: '#FBEFD2', action: () => { onClose(); router.push('/(tabs)/budget') },
      icon: <svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" fill="none" stroke={C.mustard} strokeWidth="1.8" strokeLinecap="round" /></svg> },
    { label: 'Email\nIntegrasi', bg: '#FDF2EE', action: proGate(() => { onClose(); router.push('/(tabs)/email-integration') }),
      icon: <svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" fill="none" stroke={C.expenseDeep} strokeWidth="1.8" /><polyline points="22,6 12,13 2,6" fill="none" stroke={C.expenseDeep} strokeWidth="1.8" /></svg> },
    { label: 'Workspace', bg: '#E8E0F5', action: proGate(() => { onClose(); router.push('/(tabs)/workspace' as any) }),
      icon: <svg width="22" height="22" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="none" stroke="#7C5CBF" strokeWidth="1.8" strokeLinecap="round" /><circle cx="9" cy="7" r="4" fill="none" stroke="#7C5CBF" strokeWidth="1.8" /></svg> },
    { label: 'Rekening', bg: '#DEE8D7', action: () => { onClose(); router.push('/(tabs)/accounts' as any) },
      icon: <svg width="22" height="22" viewBox="0 0 24 24"><rect x="2" y="8" width="20" height="14" rx="2" fill="none" stroke={C.primaryDeep} strokeWidth="1.8" /><path d="M6 8V6a6 6 0 0 1 12 0v2" fill="none" stroke={C.primaryDeep} strokeWidth="1.8" strokeLinecap="round" /></svg> },
    { label: 'Kategori', bg: '#F4DDD0', action: () => { onClose(); router.push('/(tabs)/categories' as any) },
      icon: <svg width="22" height="22" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" fill="none" stroke={C.expenseDeep} strokeWidth="1.8" /><rect x="14" y="3" width="7" height="7" rx="1" fill="none" stroke={C.expenseDeep} strokeWidth="1.8" /><rect x="3" y="14" width="7" height="7" rx="1" fill="none" stroke={C.expenseDeep} strokeWidth="1.8" /><rect x="14" y="14" width="7" height="7" rx="1" fill="none" stroke={C.expenseDeep} strokeWidth="1.8" /></svg> },
    { label: 'Setelan', bg: '#EEF3F0', action: () => { onClose(); router.push('/(tabs)/settings') },
      icon: <svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke={C.fg2} strokeWidth="1.8" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke={C.fg2} strokeWidth="1.8" /></svg> },
  ]

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable onPress={e => e.stopPropagation()}>
          <View style={{ backgroundColor: C.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: 32, paddingHorizontal: 20 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 20 }} />
            <TouchableOpacity
              onPress={() => { onClose(); router.push('/(tabs)/settings') }}
              style={{ borderRadius: 18, padding: 16, marginBottom: 20, backgroundColor: C.heroEnd, ...(({ background: `linear-gradient(135deg, ${C.heroStart} 0%, ${C.heroEnd} 100%)` }) as any), flexDirection: 'row', alignItems: 'center', gap: 14 }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>⭐</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff', fontFamily: 'Nunito_800ExtraBold' }}>Paket & Pembayaran</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontFamily: 'Nunito_500Medium' }}>Upgrade untuk fitur premium</Text>
              </View>
              <ChevronRight size={18} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {items.map((item) => (
                <TouchableOpacity key={item.label} onPress={item.action} style={{ width: '30%', alignItems: 'center', gap: 8, paddingVertical: 10 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 999, backgroundColor: item.bg, alignItems: 'center', justifyContent: 'center' }}>
                    {Platform.OS === 'web' ? item.icon : null}
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.fg1d, textAlign: 'center', fontFamily: 'Nunito_700Bold', lineHeight: 15 }}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Main Dashboard ────────────────────────────────────────────
export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const queryClient = useQueryClient()
  const isPro = useIsProActive()
  const [refreshing, setRefreshing]               = useState(false)
  const [bannerDismissed, setBannerDismissed]     = useState(false)
  const [showPeriod, setShowPeriod]               = useState(false)
  const [detailTransaction, setDetailTransaction] = useState<any>(null)
  const [preset, setPreset]                       = useState<Preset>('this_month')
  const [customRange, setCustomRange]             = useState<{ start: string; end: string } | undefined>()
  const [paydayDate, setPaydayDate]               = useState(25)
  const [selectedWsIds, setSelectedWsIds]         = useState<string[]>([])
  const [addModalVisible, setAddModalVisible]     = useState(false)
  const [scanModalVisible, setScanModalVisible]   = useState(false)
  const [lainnyaVisible, setLainnyaVisible]       = useState(false)
  const [wsInitialized, setWsInitialized]         = useState(false)
  const [showWsDropdown, setShowWsDropdown]       = useState(false)
  const [showProfilePopup, setShowProfilePopup]   = useState(false)
  const [wsDropPos, setWsDropPos]                 = useState({ top: 90, left: 20 })
  const [profilePopPos, setProfilePopPos]         = useState({ top: 80, right: 20 })
  const wsNameRef    = useRef<any>(null)
  const avatarRef    = useRef<any>(null)

  const range = getPresetRange(preset, customRange, paydayDate)

  const handlePresetSelect = (p: Preset, custom?: { start: string; end: string }, payday?: number) => {
    setPreset(p)
    if (p === 'custom' && custom) setCustomRange(custom)
    if (p === 'payday' && payday)  setPaydayDate(payday)
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const { data: pendingInvites } = useQuery({
    queryKey: ['ws-my-pending-invites'],
    queryFn:  () => api.get<{ id: string; role: string; token?: string; expiresAt: string }[]>('/workspaces/invites/pending').then(r => r.data ?? []),
    refetchInterval: 10_000,
  })

  const acceptInviteMut = useMutation({
    mutationFn: (token: string) => api.post('/workspaces/invites/accept', { token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      queryClient.invalidateQueries({ queryKey: ['ws-my-pending-invites'] })
    },
  })
  const declineInviteMut = useMutation({
    mutationFn: (token: string) => api.post('/workspaces/invites/decline', { token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ws-my-pending-invites'] }),
  })

  const { data: integrations } = useQuery({
    queryKey: ['email-integrations'],
    queryFn:  () => api.get<{ id: string; isActive: boolean }[]>('/email-integrations'),
    staleTime: 0, refetchOnMount: true, refetchOnWindowFocus: true,
  })
  const hasEmailIntegration = (integrations?.data?.length ?? 0) > 0
  const showGmailBanner     = !hasEmailIntegration && !bannerDismissed

  const handleConnectGmail = async () => {
    try {
      const { data } = await api.get<{ url: string }>('/email-integrations/gmail/auth')
      if (Platform.OS === 'web') { if (typeof window !== 'undefined') window.location.href = data.url }
      else await WebBrowser.openAuthSessionAsync(data.url, 'fintrackr://')
    } catch {}
  }

  const { data: workspacesData } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get<any[]>('/workspaces').then(r => r.data ?? []),
    staleTime: 60_000,
  })
  const workspaces = workspacesData ?? []

  // Auto-select first workspace on mount
  useEffect(() => {
    if (!wsInitialized && workspaces.length > 0) {
      setSelectedWsIds([workspaces[0].id])
      setWsInitialized(true)
    }
  }, [workspaces, wsInitialized])

  const scopeParams = selectedWsIds.length > 0
    ? { workspaceIds: selectedWsIds, includePersonal: true }
    : {}

  const { data: summary, isLoading: summaryLoading } = useDashboardSummary({ startDate: range.startDate, endDate: range.endDate, ...scopeParams })
  const { data: categoryData }                        = useCategoryBreakdown({ startDate: range.startDate, endDate: range.endDate, type: 'expense', ...scopeParams })
  const { data: trendRaw }                            = useMonthlyTrend(
    preset === 'payday'
      ? (() => {
          // Show 6 payday cycles: go back 6 months from current payday start
          const d = new Date(range.startDate)
          d.setMonth(d.getMonth() - 5) // 6 cycles total including current
          const sixCyclesStart = d.toISOString().split('T')[0]
          return { startDate: sixCyclesStart, endDate: range.endDate }
        })()
      : 6
  )
  const { data: paydayTrendRaw }                      = usePaydayTrend(paydayDate, 6, scopeParams)

  const { data: recentData, isLoading: recentLoading } = useTransactions({
    limit: 5, page: 1, startDate: range.startDate, endDate: range.endDate,
  })
  const activeWsId = selectedWsIds[0] ?? null
  const { data: wsRecentData, isLoading: wsRecentLoading } = useQuery({
    queryKey: ['ws-recent-tx', activeWsId, range.startDate, range.endDate],
    queryFn:  () => api.get<any>(`/workspaces/${activeWsId}/transactions`, {
      params: { limit: 5, startDate: range.startDate, endDate: range.endDate },
    }).then(r => r.data),
    enabled: !!activeWsId,
  })
  const activeRecentTxns    = activeWsId ? (wsRecentData?.data ?? []) : (recentData?.data ?? [])
  const activeRecentLoading = activeWsId ? wsRecentLoading : recentLoading

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    await queryClient.invalidateQueries({ queryKey: ['transactions'] })
    setRefreshing(false)
  }, [queryClient])

  const totalIn  = summary?.totalIncome  ?? 0
  const totalOut = summary?.totalExpense ?? 0
  const balance  = summary?.netBalance   ?? 0

  const activeWsName = useMemo(() => {
    if (selectedWsIds.length === 0) return null
    const ws = workspaces.find((w: any) => w.id === selectedWsIds[0])
    return ws?.name ?? null
  }, [selectedWsIds, workspaces])

  const displayName = activeWsName ?? (user?.name ?? 'Kamu')

  const topCats   = (categoryData ?? []).slice(0, 4)
  const maxAmt    = topCats[0]?.total ?? 1
  const CAT_COLORS = ['#C97B5C','#6B8E6B','#D9A441','#6E97AE','#C66B6B','#7E4F94']

  const trendData = useMemo(() => {
    if (!trendRaw || !Array.isArray(trendRaw)) return []
    return (trendRaw as { month: string; income: number; expense: number }[])
      .slice().sort((a, b) => a.month.localeCompare(b.month))
      .map(row => ({
        label:   format(new Date(row.month + '-02'), 'MMM', { locale: id }),
        income:  row.income  ?? 0,
        expense: row.expense ?? 0,
      }))
  }, [trendRaw])

  const paydayChartData = useMemo(() => {
    if (!paydayTrendRaw || !Array.isArray(paydayTrendRaw)) return []
    return (paydayTrendRaw as { label: string; income: number; expense: number }[])
      .map(row => ({
        label:   row.label,
        income:  row.income  ?? 0,
        expense: row.expense ?? 0,
      }))
  }, [paydayTrendRaw])

  const chartData = preset === 'payday' ? paydayChartData : trendData

  const momComparison = useMemo(() => {
    if (!trendRaw || !Array.isArray(trendRaw)) return { incomePct: null as number | null, expensePct: null as number | null }
    const sorted = [...(trendRaw as { month: string; income: number; expense: number }[])]
      .sort((a, b) => a.month.localeCompare(b.month))
    if (sorted.length < 2) return { incomePct: null, expensePct: null }
    const curr = sorted[sorted.length - 1]
    const prev = sorted[sorted.length - 2]
    const incPct = prev.income > 0 ? Math.round(((curr.income - prev.income) / prev.income) * 100) : null
    const expPct = prev.expense > 0 ? Math.round(((curr.expense - prev.expense) / prev.expense) * 100) : null
    return { incomePct: incPct, expensePct: expPct }
  }, [trendRaw])

  const growthBadge = useMemo(() => {
    if (!trendRaw || !Array.isArray(trendRaw)) return null
    const sorted = [...(trendRaw as { month: string; income: number; expense: number }[])]
      .sort((a, b) => a.month.localeCompare(b.month))
    if (sorted.length < 2) return null
    const curr = sorted[sorted.length - 1]
    const prev = sorted[sorted.length - 2]
    const currNet = (curr.income ?? 0) - (curr.expense ?? 0)
    const prevNet = (prev.income ?? 0) - (prev.expense ?? 0)
    if (prevNet === 0) return null
    const pct = ((currNet - prevNet) / Math.abs(prevNet)) * 100
    return { pct: Math.round(Math.abs(pct)), positive: pct >= 0 }
  }, [trendRaw])

  const hourNow = new Date().getHours()
  const greeting = hourNow < 12 ? 'Selamat Pagi' : hourNow < 17 ? 'Selamat Siang' : 'Selamat Malam'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      {/* Backdrop + floating dropdowns — outside ScrollView so they're never clipped by card overlap */}
      {(showWsDropdown || showProfilePopup) && (
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }}
          onPress={() => { setShowWsDropdown(false); setShowProfilePopup(false) }}
        />
      )}

      {/* Workspace dropdown */}
      {showWsDropdown && (
        <View style={{
          position: 'absolute', top: wsDropPos.top, left: wsDropPos.left,
          backgroundColor: '#fff', borderRadius: 14, padding: 6,
          minWidth: 180, zIndex: 100,
          shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
        }}>
          <TouchableOpacity
            onPress={() => { setSelectedWsIds([]); setShowWsDropdown(false) }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: selectedWsIds.length === 0 ? '#F0FAF4' : 'transparent' }}
          >
            {selectedWsIds.length === 0 && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.primaryDeep }} />}
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.fg1d, fontFamily: 'Nunito_700Bold' }}>Pribadi</Text>
          </TouchableOpacity>
          {workspaces.map((ws: any) => {
            const active = selectedWsIds.includes(ws.id)
            return (
              <TouchableOpacity
                key={ws.id}
                onPress={() => { setSelectedWsIds([ws.id]); setShowWsDropdown(false) }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: active ? '#F0FAF4' : 'transparent' }}
              >
                {active && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.primaryDeep }} />}
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.fg1d, fontFamily: 'Nunito_700Bold' }}>{ws.name}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      {/* Profile popup */}
      {showProfilePopup && (
        <View style={{
          position: 'absolute', top: profilePopPos.top, right: profilePopPos.right,
          width: 220, backgroundColor: '#fff', borderRadius: 16,
          shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 20,
          zIndex: 100, overflow: 'hidden',
        }}>
          <View style={{ padding: 14, backgroundColor: '#F7FAFA', borderBottomWidth: 1, borderBottomColor: C.divider }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0A830', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15, fontFamily: 'Nunito_900Black' }}>
                  {(user?.name ?? 'K').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.fg1d, fontFamily: 'Nunito_800ExtraBold' }} numberOfLines={1}>{user?.name ?? ''}</Text>
                <Text style={{ fontSize: 11, color: C.fg3, fontFamily: 'Nunito_500Medium' }} numberOfLines={1}>{user?.email ?? ''}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => { setShowProfilePopup(false); router.push('/(tabs)/settings') }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.divider }}
          >
            {Platform.OS === 'web' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={C.fg2} strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="7" r="4" stroke={C.fg2} strokeWidth="2" /></svg>}
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.fg1, fontFamily: 'Nunito_600SemiBold' }}>Profil Saya</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setShowProfilePopup(false); router.push('/(tabs)/settings?section=billing' as any) }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.divider }}
          >
            {Platform.OS === 'web' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke={C.mustard} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.fg1, fontFamily: 'Nunito_600SemiBold' }}>Paket & Pembayaran</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setShowProfilePopup(false); logout(); router.replace('/(auth)/login') }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 }}
          >
            {Platform.OS === 'web' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#C97B5C" strokeWidth="2" strokeLinecap="round" /><polyline points="16 17 21 12 16 7" stroke="#C97B5C" strokeWidth="2" strokeLinecap="round" /><line x1="21" y1="12" x2="9" y2="12" stroke="#C97B5C" strokeWidth="2" strokeLinecap="round" /></svg>}
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#C97B5C', fontFamily: 'Nunito_600SemiBold' }}>Keluar</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />}
      >
        {/* ── Hero ── */}
        <View style={{
          backgroundColor: C.heroStart,
          ...(({ background: `linear-gradient(160deg, ${C.heroStart} 0%, ${C.heroEnd} 100%)` }) as any),
          paddingTop: 20, paddingBottom: 48, paddingHorizontal: 20,
          borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
        }}>
          {/* Top row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Greeting + clickable workspace name */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)', fontFamily: 'Nunito_600SemiBold' }}>
                {greeting}
              </Text>
              <TouchableOpacity
                ref={wsNameRef}
                onPress={() => {
                  if (wsNameRef.current?.measureInWindow) {
                    wsNameRef.current.measureInWindow((_x: number, y: number, _w: number, h: number) => {
                      setWsDropPos({ top: y + h + 6, left: 20 })
                    })
                  }
                  setShowWsDropdown(v => !v)
                  setShowProfilePopup(false)
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', fontFamily: 'Nunito_800ExtraBold' }}>
                  {displayName} 👋
                </Text>
                {Platform.OS === 'web' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <polyline points="6 9 12 15 18 9" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </TouchableOpacity>
            </View>

            {/* Bell + Avatar */}
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <View style={{ position: 'relative' }}>
                <View style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  {Platform.OS === 'web' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </View>
                <View style={{ position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: 4, backgroundColor: '#E8A020', borderWidth: 1.5, borderColor: C.heroEnd }} />
              </View>

              {/* Avatar — clickable → ProfilePopup (rendered outside ScrollView) */}
              <TouchableOpacity
                ref={avatarRef}
                onPress={() => {
                  if (avatarRef.current?.measureInWindow) {
                    avatarRef.current.measureInWindow((x: number, y: number, w: number, h: number) => {
                      setProfilePopPos({ top: y + h + 6, right: 20 })
                    })
                  }
                  setShowProfilePopup(v => !v)
                  setShowWsDropdown(false)
                }}
                activeOpacity={0.85}
              >
                <View style={{
                  width: 38, height: 38, borderRadius: 19,
                  backgroundColor: '#F0A830',
                  ...(({ background: 'linear-gradient(135deg, #F0A830 0%, #E8802A 100%)' }) as any),
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, fontFamily: 'Nunito_900Black' }}>
                    {(user?.name ?? 'K').charAt(0).toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Balance — CENTERED */}
          <View style={{ alignItems: 'center', marginTop: 28 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)', fontFamily: 'Nunito_600SemiBold' }}>
              Total Saldo Keluarga
            </Text>
            <Text style={{ fontSize: 40, fontWeight: '900', color: '#fff', marginTop: 6, letterSpacing: -0.03 * 40, lineHeight: 48, fontFamily: 'Nunito_900Black', fontVariant: ['tabular-nums'] as any }}>
              {summaryLoading ? '—' : formatCurrency(balance)}
            </Text>
            {growthBadge && !summaryLoading && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 10, gap: 4 }}>
                {Platform.OS === 'web' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <polyline points={growthBadge.positive ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} stroke="#5DCEA0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>
                  {growthBadge.positive ? '+' : '-'}{growthBadge.pct}% dari bulan lalu
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Income / Expense cards ── */}
        <View style={{ flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: -22 }}>
          <View style={{ flex: 1, backgroundColor: '#F0FAF4', borderRadius: 20, padding: 16, shadowColor: '#3D7A56', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 4 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.primaryDeep, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              {Platform.OS === 'web' ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points="18 15 12 9 6 15" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
            </View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#5A7066', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Nunito_700Bold', marginBottom: 3 }}>PEMASUKAN</Text>
            <Text style={{ fontSize: 18, fontWeight: '900', color: C.fg1d, fontFamily: 'Nunito_900Black', fontVariant: ['tabular-nums'] as any, letterSpacing: -0.02 * 18 }}>
              {summaryLoading ? '—' : formatCurrencyCompact(totalIn)}
            </Text>
            {momComparison.incomePct !== null && (
              <Text style={{ fontSize: 11, fontWeight: '600', color: C.primaryDeep, fontFamily: 'Nunito_600SemiBold', marginTop: 5 }}>
                {momComparison.incomePct >= 0 ? '↑' : '↓'} {Math.abs(momComparison.incomePct)}% vs bln lalu
              </Text>
            )}
          </View>
          <View style={{ flex: 1, backgroundColor: '#FDF2EE', borderRadius: 20, padding: 16, shadowColor: '#D4704A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 4 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.expenseDeep, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              {Platform.OS === 'web' ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points="6 9 12 15 18 9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
            </View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#5A7066', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Nunito_700Bold', marginBottom: 3 }}>PENGELUARAN</Text>
            <Text style={{ fontSize: 18, fontWeight: '900', color: C.fg1d, fontFamily: 'Nunito_900Black', fontVariant: ['tabular-nums'] as any, letterSpacing: -0.02 * 18 }}>
              {summaryLoading ? '—' : formatCurrencyCompact(totalOut)}
            </Text>
            {momComparison.expensePct !== null && (
              <Text style={{ fontSize: 11, fontWeight: '600', color: C.expenseDeep, fontFamily: 'Nunito_600SemiBold', marginTop: 5 }}>
                {momComparison.expensePct >= 0 ? '↑' : '↓'} {Math.abs(momComparison.expensePct)}% vs bln lalu
              </Text>
            )}
          </View>
        </View>

        {/* ── Period filter pills ── */}
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 16 }}>
          {([
            { key: 'this_month' as Preset, label: 'Bulan ini' },
            { key: 'payday'     as Preset, label: 'Periode Gajian' },
            { key: 'custom'     as Preset, label: 'Custom', isCustom: true },
          ] as Array<{ key: Preset; label: string; isCustom?: boolean }>).map(({ key, label, isCustom }) => (
            <TouchableOpacity
              key={key}
              onPress={() => key === 'custom' ? setShowPeriod(true) : handlePresetSelect(key)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: preset === key ? '#6B8E6B' : '#EDE8DF' }}
            >
              {isCustom && Platform.OS === 'web' && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke={preset === key ? '#fff' : C.fg2} strokeWidth="2" />
                  <line x1="16" y1="2" x2="16" y2="6" stroke={preset === key ? '#fff' : C.fg2} strokeWidth="2" strokeLinecap="round" />
                  <line x1="8" y1="2" x2="8" y2="6" stroke={preset === key ? '#fff' : C.fg2} strokeWidth="2" strokeLinecap="round" />
                  <line x1="3" y1="10" x2="21" y2="10" stroke={preset === key ? '#fff' : C.fg2} strokeWidth="2" />
                </svg>
              )}
              <Text style={{ fontSize: 12, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: preset === key ? '#fff' : C.fg2 }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Quick Actions ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 16, marginTop: 20, paddingVertical: 4 }}>
          {([
            { label: 'Tambah', bg: '#3D7A56', shadowColor: '#3D7A56', action: () => setAddModalVisible(true),
              icon: <svg width="24" height="24" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" /><line x1="5" y1="12" x2="19" y2="12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" /></svg> },
            { label: 'Workspace', bg: '#7C5CBF', shadowColor: '#7C5CBF', action: () => { if (!isPro) { Alert.alert('Fitur Pro', 'This Feature only for Pro Member', [{ text: 'OK' }]); return; } router.push('/(tabs)/workspace' as any) },
              icon: <svg width="22" height="22" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" /><circle cx="9" cy="7" r="4" fill="none" stroke="#fff" strokeWidth="2" /></svg> },
            { label: 'Scan Struk', bg: '#2B7A9E', shadowColor: '#2B7A9E', action: () => setScanModalVisible(true),
              icon: <svg width="22" height="22" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="18" rx="2" fill="none" stroke="#fff" strokeWidth="1.8" /><line x1="8" y1="7" x2="16" y2="7" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /><line x1="8" y1="10.5" x2="16" y2="10.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /><line x1="8" y1="14" x2="12" y2="14" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /></svg> },
            { label: 'Lainnya', bg: '#55504A', shadowColor: '#55504A', action: () => setLainnyaVisible(true),
              icon: <svg width="22" height="22" viewBox="0 0 24 24">{[6,12,18].flatMap(cx => [7,13,19].map(cy => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" fill="#fff" />))}</svg> },
          ] as const).map(({ icon, label, bg, shadowColor, action }) => (
            <TouchableOpacity key={label} onPress={action} style={{ alignItems: 'center', gap: 8 }}>
              <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', shadowColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 }}>
                {Platform.OS === 'web' ? icon : null}
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.fg1d, fontFamily: 'Nunito_700Bold' }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Gmail banner ── */}
        {showGmailBanner && (
          <View style={{ marginHorizontal: 16, marginTop: 16 }}>
            <TouchableOpacity onPress={handleConnectGmail} style={{ backgroundColor: '#FBEFD2', borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#E3B25A' }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={22} color={C.mustard} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.fg1, fontFamily: 'Nunito_800ExtraBold' }}>Auto-Import Transaksi</Text>
                <Text style={{ fontSize: 12, color: C.fg2, marginTop: 2, fontFamily: 'Nunito_500Medium' }}>Hubungkan Gmail untuk import otomatis</Text>
              </View>
              <ChevronRight size={16} color={C.fg3} strokeWidth={2} />
              <TouchableOpacity onPress={() => setBannerDismissed(true)} style={{ position: 'absolute', top: 8, right: 8 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={14} color={C.fg3} strokeWidth={2.5} />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Workspace invite banners ── */}
        {(pendingInvites ?? []).map((inv) => (
          <View key={inv.id} style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#FBEFD2', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#D9A441' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FBEFD2', alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={20} color={C.mustard} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.fg1, fontFamily: 'Nunito_800ExtraBold' }}>Undangan Workspace</Text>
                <Text style={{ fontSize: 12, color: C.fg2, marginTop: 2, fontFamily: 'Nunito_500Medium' }}>Kamu diundang sebagai {inv.role}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => inv.token && acceptInviteMut.mutate(inv.token)} disabled={acceptInviteMut.isPending || !inv.token} style={{ flex: 1, backgroundColor: C.primaryDeep, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13, fontFamily: 'Nunito_800ExtraBold' }}>Terima</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => inv.token && declineInviteMut.mutate(inv.token)} disabled={declineInviteMut.isPending || !inv.token} style={{ flex: 1, backgroundColor: '#F4EEE3', borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ color: C.fg2, fontWeight: '700', fontSize: 13, fontFamily: 'Nunito_700Bold' }}>Tolak</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={{ paddingHorizontal: 16, paddingTop: 20, gap: 16 }}>

          {/* ── Tren 6 Bulan ── */}
          {chartData.length > 0 && (
            <View style={{ backgroundColor: '#F7FAFA', borderRadius: 20, padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: C.fg1d, fontFamily: 'Nunito_800ExtraBold' }}>
                  {preset === 'payday' ? 'Tren Gajian' : 'Tren 6 Bulan'}
                </Text>
                <Text style={{ fontSize: 11, color: C.fg3, fontFamily: 'Nunito_500Medium' }}>
                  {preset === 'payday' ? range.label.replace('Gajian 25 ', '') : '6 bulan terakhir'}
                </Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.primaryDeep, fontFamily: 'Nunito_700Bold' }}>Lihat Semua</Text>
                </TouchableOpacity>
              </View>
              <TrendBarChart data={chartData} />
              <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: C.primaryDeep }} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#5A7066', fontFamily: 'Nunito_600SemiBold' }}>Pemasukan</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: C.expenseDeep }} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#5A7066', fontFamily: 'Nunito_600SemiBold' }}>Pengeluaran</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Transaksi Terbaru ── */}
          <View style={{ backgroundColor: C.surface, borderRadius: 18, overflow: 'hidden', shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: C.fg1, fontFamily: 'Nunito_900Black' }}>Transaksi Terbaru</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.primaryDeep, fontFamily: 'Nunito_700Bold' }}>Lihat semua</Text>
              </TouchableOpacity>
            </View>
            {activeRecentLoading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}><LoadingSpinner /></View>
            ) : activeRecentTxns.length > 0 ? (
              <View>
                {activeRecentTxns.map((txn: any, idx: number) => (
                  <View key={txn.id}>
                    <TransactionItem transaction={txn} onPress={() => setDetailTransaction(txn)} />
                    {idx < activeRecentTxns.length - 1 && <View style={{ height: 1, backgroundColor: C.divider, marginLeft: 70 }} />}
                  </View>
                ))}
                <View style={{ height: 8 }} />
              </View>
            ) : (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.fg2, fontFamily: 'Nunito_700Bold' }}>Belum ada transaksi</Text>
                <Text style={{ fontSize: 13, color: C.fg3, marginTop: 4 }}>Tambahkan transaksi pertamamu</Text>
              </View>
            )}
          </View>

          {summary && summary.totalExpense > 0 && summary.totalIncome > 0 && (
            <View style={{ backgroundColor: '#DEE8D7', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#C2D4B9', flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ width: 36, height: 36, backgroundColor: 'rgba(61,122,86,0.15)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                <Text style={{ fontSize: 18 }}>💡</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.heroEnd, fontFamily: 'Nunito_800ExtraBold' }}>Insight Periode Ini</Text>
                <Text style={{ fontSize: 13, fontWeight: '500', color: C.fg2, marginTop: 4, lineHeight: 20, fontFamily: 'Nunito_500Medium' }}>
                  {balance >= 0 ? `Kamu menabung ${formatCurrencyCompact(balance)}. ` : `Pengeluaran melebihi pemasukan ${formatCurrencyCompact(Math.abs(balance))}. `}
                  Rasio pengeluaran:{' '}
                  <Text style={{ fontWeight: '800', color: C.fg1, fontFamily: 'Nunito_800ExtraBold' }}>{Math.round((summary.totalExpense / summary.totalIncome) * 100)}%</Text>
                  {' '}dari pemasukan.
                </Text>
              </View>
            </View>
          )}

          <View style={{ height: 24 }} />
        </View>
      </ScrollView>

      <PeriodModal visible={showPeriod} current={preset} paydayDate={paydayDate} onSelect={handlePresetSelect} onClose={() => setShowPeriod(false)} />
      <TransactionDetailModal transaction={detailTransaction} visible={detailTransaction !== null} onClose={() => setDetailTransaction(null)} onDeleted={() => setDetailTransaction(null)} />
      <AddTransactionModal visible={addModalVisible} onClose={() => setAddModalVisible(false)} />
      <PaymentSlipScanModal visible={scanModalVisible} onClose={() => setScanModalVisible(false)} />
      <LainnyaSheet visible={lainnyaVisible} onClose={() => setLainnyaVisible(false)} onAdd={() => setAddModalVisible(true)} onScan={() => setScanModalVisible(true)} />
    </SafeAreaView>
  )
}
