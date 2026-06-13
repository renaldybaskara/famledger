import { useState, useCallback, useMemo } from 'react'
import {
  View, Text, ScrollView, RefreshControl,
  TouchableOpacity, Linking, Platform,
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useDashboardSummary, useCategoryBreakdown, useMonthlyTrend } from '../../src/hooks/useDashboard'
import { useTransactions } from '../../src/hooks/useTransactions'
import { useAuthStore } from '../../src/store/auth.store'
import { api } from '../../src/lib/api'
import { formatCurrency, formatCurrencyCompact } from '../../src/lib/format'
import { TransactionItem } from '../../components/transactions/TransactionItem'
import { TransactionDetailModal } from '../../components/transactions/TransactionDetailModal'
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
  primarySoft:  '#DEE8D7',
  incomeSoft:   '#DEE8D7',
  expenseSoft:  '#F4DDD0',
  savingSoft:   '#FBEFD2',
  fg1:          '#2D2A26',
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
      <View style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: color + '22',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color }} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.fg1, fontFamily: 'Nunito_700Bold' }}>{name}</Text>
          <Text style={{ fontSize: 13, fontWeight: '800', color: C.fg1, fontFamily: 'Nunito_800ExtraBold', fontVariant: ['tabular-nums'] as any }}>
            {formatCurrencyCompact(amount)}
          </Text>
        </View>
        <View style={{ height: 6, borderRadius: 999, backgroundColor: C.creamSunken, overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(pct, 100)}%` as any, height: '100%', backgroundColor: color, borderRadius: 999 }} />
        </View>
      </View>
    </View>
  )
}

// ── Main Dashboard ────────────────────────────────────────────
export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const [bannerDismissed, setBannerDismissed]     = useState(false)
  const [showPeriod, setShowPeriod]               = useState(false)
  const [detailTransaction, setDetailTransaction] = useState<any>(null)
  const [preset, setPreset] = useState<Preset>('this_month')
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | undefined>()
  const [paydayDate, setPaydayDate] = useState(25)
  const [selectedWsIds, setSelectedWsIds] = useState<string[]>([])

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
    queryKey:         ['email-integrations'],
    queryFn:          () => api.get<{ id: string; isActive: boolean }[]>('/email-integrations'),
    staleTime:        0,
    refetchOnMount:   true,
    refetchOnWindowFocus: true,
  })
  const hasEmailIntegration = (integrations?.data?.length ?? 0) > 0
  const showGmailBanner     = !hasEmailIntegration && !bannerDismissed

  const handleConnectGmail = async () => {
    try {
      const { data } = await api.get<{ url: string }>('/email-integrations/gmail/auth')
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.location.href = data.url
      } else {
        await WebBrowser.openAuthSessionAsync(data.url, 'fintrackr://')
      }
    } catch {}
  }

  const { data: workspacesData } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get<any[]>('/workspaces').then(r => r.data ?? []),
    staleTime: 60_000,
  })
  const workspaces = workspacesData ?? []

  const toggleWs = (id: string) =>
    setSelectedWsIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const scopeParams = selectedWsIds.length > 0
    ? { workspaceIds: selectedWsIds, includePersonal: true }
    : {}

  const { data: summary, isLoading: summaryLoading } = useDashboardSummary({ startDate: range.startDate, endDate: range.endDate, ...scopeParams })
  const { data: categoryData }                        = useCategoryBreakdown({ startDate: range.startDate, endDate: range.endDate, type: 'expense', ...scopeParams })
  const { data: trendRaw }                            = useMonthlyTrend(6)

  // Recent transactions — personal with date filter
  const { data: recentData, isLoading: recentLoading } = useTransactions({
    limit: 5, page: 1, startDate: range.startDate, endDate: range.endDate,
  })
  // Recent transactions — first selected workspace with date filter
  const activeWsId = selectedWsIds[0] ?? null
  const { data: wsRecentData, isLoading: wsRecentLoading } = useQuery({
    queryKey: ['ws-recent-tx', activeWsId, range.startDate, range.endDate],
    queryFn:  () => api.get<any>(`/workspaces/${activeWsId}/transactions`, {
      params: { limit: 5, startDate: range.startDate, endDate: range.endDate },
    }).then(r => r.data),
    enabled: !!activeWsId,
  })
  const activeRecentTxns = activeWsId ? (wsRecentData?.data ?? []) : (recentData?.data ?? [])
  const activeRecentLoading = activeWsId ? wsRecentLoading : recentLoading

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    await queryClient.invalidateQueries({ queryKey: ['transactions'] })
    setRefreshing(false)
  }, [queryClient])

  const firstName = user?.name?.split(' ')[0] ?? 'Kamu'
  const totalIn   = summary?.totalIncome  ?? 0
  const totalOut  = summary?.totalExpense ?? 0
  const balance   = summary?.netBalance   ?? 0

  // Build top categories
  const topCats = (categoryData ?? []).slice(0, 4)
  const maxAmt  = topCats[0]?.total ?? 1

  // Category accent colors (fallback palette)
  const CAT_COLORS = ['#C97B5C','#6B8E6B','#D9A441','#6E97AE','#C66B6B','#7E4F94']

  // Monthly trend: [{month:"2026-01",type:"income",total:N},...] → [{label:"Jan",income:N,expense:N},...]
  const trendData = useMemo(() => {
    if (!trendRaw || !Array.isArray(trendRaw)) return []
    const map: Record<string, { label: string; income: number; expense: number }> = {}
    for (const row of trendRaw as { month: string; type: string; total: number }[]) {
      if (!map[row.month]) {
        const d = new Date(row.month + '-02')
        map[row.month] = { label: format(d, 'MMM', { locale: id }), income: 0, expense: 0 }
      }
      if (row.type === 'income')  map[row.month].income  = row.total
      if (row.type === 'expense') map[row.month].expense = row.total
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v)
  }, [trendRaw])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />
        }
      >
        {/* ── Hero ── */}
        <View style={{
          backgroundColor: C.heroStart,
          ...(({ background: `linear-gradient(160deg, ${C.heroStart} 0%, ${C.heroEnd} 100%)` }) as any),
          paddingTop: 24, paddingBottom: 40,
          paddingHorizontal: 22,
          borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
          overflow: 'hidden', position: 'relative',
        }}>
          {/* Background blobs */}
          <View style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: 999, backgroundColor: C.accent, opacity: 0.35 }} />
          <View style={{ position: 'absolute', bottom: -40, left: -50, width: 180, height: 180, borderRadius: 999, backgroundColor: '#A2BD97', opacity: 0.4 }} />

          {/* Top row: greeting + notif + avatar */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
            <View>
              <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', fontFamily: 'Nunito_800ExtraBold' }}>
                {format(new Date(), 'EEEE, d MMM', { locale: id })}
              </Text>
              <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 4, letterSpacing: -0.5, fontFamily: 'Nunito_900Black' }}>
                Halo, {firstName} 🌿
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <View style={{
                width: 40, height: 40, borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 18 }}>🔔</Text>
              </View>
              <View style={{
                width: 40, height: 40, borderRadius: 999,
                backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, fontFamily: 'Nunito_900Black' }}>
                  {firstName.charAt(0).toUpperCase()}
                </Text>
              </View>
            </View>
          </View>

          {/* Balance */}
          <View style={{ position: 'relative', marginTop: 28 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: 'Nunito_700Bold' }}>
              Saldo bulan ini
            </Text>
            <Text style={{ fontSize: 36, fontWeight: '900', color: '#fff', marginTop: 4, letterSpacing: -1, fontFamily: 'Nunito_900Black', fontVariant: ['tabular-nums'] as any }}>
              {summaryLoading ? '—' : formatCurrency(balance)}
            </Text>
          </View>

          {/* Period chip */}
          <TouchableOpacity
            onPress={() => setShowPeriod(true)}
            style={{
              marginTop: 14, flexDirection: 'row', alignItems: 'center',
              alignSelf: 'flex-start',
              backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999,
              paddingHorizontal: 14, paddingVertical: 6,
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)', fontFamily: 'Nunito_700Bold' }}>
              {range.label}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', marginLeft: 6 }}>▾</Text>
          </TouchableOpacity>

          {/* In / Out glass cards */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, position: 'relative' }}>
            {[
              { label: 'MASUK', amount: totalIn,  arrow: '↓' },
              { label: 'KELUAR', amount: totalOut, arrow: '↑' },
            ].map(({ label, amount, arrow }) => (
              <View key={label} style={{
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.18)',
                borderRadius: 16, padding: 14,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>{arrow}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: 'Nunito_800ExtraBold' }}>
                    {label}
                  </Text>
                </View>
                <Text style={{ fontSize: 17, fontWeight: '900', color: '#fff', fontFamily: 'Nunito_900Black', fontVariant: ['tabular-nums'] as any }}>
                  {summaryLoading ? '—' : formatCurrencyCompact(amount)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Workspace context chips ── */}
        {workspaces.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: C.fg4, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, fontFamily: 'Nunito_800ExtraBold' }}>
              Tampilkan data dari
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity
                onPress={() => setSelectedWsIds([])}
                style={{
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
                  backgroundColor: selectedWsIds.length === 0 ? C.primary : C.surface,
                  borderWidth: 1.5, borderColor: selectedWsIds.length === 0 ? C.primary : C.border,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: selectedWsIds.length === 0 ? '#fff' : C.fg2, fontFamily: 'Nunito_700Bold' }}>Pribadi</Text>
              </TouchableOpacity>
              {workspaces.map((ws: any) => {
                const active = selectedWsIds.includes(ws.id)
                return (
                  <TouchableOpacity
                    key={ws.id}
                    onPress={() => toggleWs(ws.id)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
                      backgroundColor: active ? C.primary : C.surface,
                      borderWidth: 1.5, borderColor: active ? C.primary : C.border,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : C.fg2, fontFamily: 'Nunito_700Bold' }}>{ws.name}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Gmail banner ── */}
        {showGmailBanner && (
          <View style={{ marginHorizontal: 16, marginTop: 16 }}>
            <TouchableOpacity
              onPress={handleConnectGmail}
              style={{
                backgroundColor: '#FBEFD2', borderRadius: 18, padding: 16,
                flexDirection: 'row', alignItems: 'center', gap: 14,
                borderWidth: 1, borderColor: '#E3B25A',
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>⚡</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.fg1, fontFamily: 'Nunito_800ExtraBold' }}>Auto-Import Transaksi</Text>
                <Text style={{ fontSize: 12, color: C.fg2, marginTop: 2, fontFamily: 'Nunito_500Medium' }}>Hubungkan Gmail untuk import otomatis</Text>
              </View>
              <Text style={{ fontSize: 18, color: C.fg3 }}>›</Text>
              <TouchableOpacity
                onPress={() => setBannerDismissed(true)}
                style={{ position: 'absolute', top: 8, right: 8 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ color: C.fg3, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Workspace invite banners ── */}
        {(pendingInvites ?? []).map((inv) => (
          <View key={inv.id} style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#FBEFD2', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#D9A441' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FBEFD2', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 20 }}>✉️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.fg1, fontFamily: 'Nunito_800ExtraBold' }}>Undangan Workspace</Text>
                <Text style={{ fontSize: 12, color: C.fg2, marginTop: 2, fontFamily: 'Nunito_500Medium' }}>
                  Kamu diundang sebagai {inv.role}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => inv.token && acceptInviteMut.mutate(inv.token)}
                disabled={acceptInviteMut.isPending || !inv.token}
                style={{ flex: 1, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13, fontFamily: 'Nunito_800ExtraBold' }}>Terima</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => inv.token && declineInviteMut.mutate(inv.token)}
                disabled={declineInviteMut.isPending || !inv.token}
                style={{ flex: 1, backgroundColor: '#F4EEE3', borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}
              >
                <Text style={{ color: C.fg2, fontWeight: '700', fontSize: 13, fontFamily: 'Nunito_700Bold' }}>Tolak</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={{ paddingHorizontal: 16, paddingTop: 20, gap: 16 }}>

          {/* ── Tren Bulanan ── */}
          {trendData.length > 0 && (
            <View style={{ backgroundColor: C.surface, borderRadius: 18, padding: 16, shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: C.fg1, fontFamily: 'Nunito_900Black' }}>Tren 6 Bulan</Text>
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: C.primary }} />
                    <Text style={{ fontSize: 11, color: C.fg3, fontFamily: 'Nunito_600SemiBold' }}>Masuk</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: C.accent }} />
                    <Text style={{ fontSize: 11, color: C.fg3, fontFamily: 'Nunito_600SemiBold' }}>Keluar</Text>
                  </View>
                </View>
              </View>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={trendData} barGap={3} barCategoryGap="30%" margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.divider} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.fg3, fontFamily: 'Nunito_600SemiBold' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => formatCurrencyCompact(v)} tick={{ fontSize: 10, fill: C.fg4, fontFamily: 'Nunito_500Medium' }} axisLine={false} tickLine={false} width={56} />
                  <Tooltip
                    cursor={{ fill: C.creamSunken }}
                    contentStyle={{ borderRadius: 12, border: `1px solid ${C.border}`, backgroundColor: C.surface, fontFamily: 'Nunito_700Bold', fontSize: 12 }}
                    formatter={(value: number, name: string) => [formatCurrency(value), name === 'income' ? 'Masuk' : 'Keluar']}
                  />
                  <Bar dataKey="income"  fill={C.primary} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" fill={C.accent}  radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </View>
          )}

          {/* ── Top Kategori ── */}
          {topCats.length > 0 && (
            <View style={{ backgroundColor: C.surface, borderRadius: 18, padding: 16, shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: C.fg1, fontFamily: 'Nunito_900Black' }}>Top Kategori</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/budget')}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.primary, fontFamily: 'Nunito_700Bold' }}>Lihat semua</Text>
                </TouchableOpacity>
              </View>
              {topCats.map((cat, i) => (
                <CategoryRow
                  key={cat.categoryId ?? i}
                  name={cat.categoryName ?? 'Lainnya'}
                  amount={cat.total}
                  color={CAT_COLORS[i % CAT_COLORS.length]}
                  pct={(cat.total / maxAmt) * 100}
                />
              ))}
            </View>
          )}

          {/* ── Transaksi Terbaru ── */}
          <View style={{ backgroundColor: C.surface, borderRadius: 18, overflow: 'hidden', shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: C.fg1, fontFamily: 'Nunito_900Black' }}>Transaksi Terbaru</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.primary, fontFamily: 'Nunito_700Bold' }}>Lihat semua</Text>
              </TouchableOpacity>
            </View>

            {activeRecentLoading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <LoadingSpinner />
              </View>
            ) : activeRecentTxns.length > 0 ? (
              <View>
                {activeRecentTxns.map((txn: any, idx: number) => (
                  <View key={txn.id}>
                    <TransactionItem transaction={txn} onPress={() => setDetailTransaction(txn)} />
                    {idx < activeRecentTxns.length - 1 && (
                      <View style={{ height: 1, backgroundColor: C.divider, marginLeft: 70 }} />
                    )}
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

          {/* ── Quick Insight ── */}
          {summary && summary.totalExpense > 0 && summary.totalIncome > 0 && (
            <View style={{
              backgroundColor: C.primarySoft, borderRadius: 18, padding: 16,
              borderWidth: 1, borderColor: '#C2D4B9',
              flexDirection: 'row', alignItems: 'flex-start', gap: 12,
            }}>
              <View style={{ width: 36, height: 36, backgroundColor: 'rgba(107,142,107,0.2)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                <Text style={{ fontSize: 18 }}>💡</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.heroEnd, fontFamily: 'Nunito_800ExtraBold' }}>Insight Periode Ini</Text>
                <Text style={{ fontSize: 13, fontWeight: '500', color: C.fg2, marginTop: 4, lineHeight: 20, fontFamily: 'Nunito_500Medium' }}>
                  {balance >= 0
                    ? `Kamu menabung ${formatCurrencyCompact(balance)}. `
                    : `Pengeluaran melebihi pemasukan ${formatCurrencyCompact(Math.abs(balance))}. `}
                  Rasio pengeluaran:{' '}
                  <Text style={{ fontWeight: '800', color: C.fg1, fontFamily: 'Nunito_800ExtraBold' }}>
                    {Math.round((summary.totalExpense / summary.totalIncome) * 100)}%
                  </Text>
                  {' '}dari pemasukan.
                </Text>
              </View>
            </View>
          )}

          <View style={{ height: 24 }} />
        </View>
      </ScrollView>

      <PeriodModal
        visible={showPeriod}
        current={preset}
        paydayDate={paydayDate}
        onSelect={handlePresetSelect}
        onClose={() => setShowPeriod(false)}
      />

      <TransactionDetailModal
        transaction={detailTransaction}
        visible={detailTransaction !== null}
        onClose={() => setDetailTransaction(null)}
        onDeleted={() => setDetailTransaction(null)}
      />
    </SafeAreaView>
  )
}
