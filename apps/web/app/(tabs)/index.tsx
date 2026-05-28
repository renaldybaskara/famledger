import { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import {
  Bell, TrendingUp, TrendingDown, ChevronRight, Mail, X, Zap,
  Calendar, ChevronDown, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react'
import { router } from 'expo-router'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { id } from 'date-fns/locale'
import { useDashboardSummary, useCategoryBreakdown, useMonthlyTrend } from '../../src/hooks/useDashboard'
import { useTransactions } from '../../src/hooks/useTransactions'
import { useAuthStore } from '../../src/store/auth.store'
import { api } from '../../src/lib/api'
import { getCurrentMonthRange, formatCurrency, formatCurrencyCompact } from '../../src/lib/format'
import { SummaryCard } from '../../components/dashboard/SummaryCard'
import { CategoryPieChart } from '../../components/dashboard/CategoryPieChart'
import { MonthlyBarChart } from '../../components/dashboard/MonthlyBarChart'
import { TransactionItem } from '../../components/transactions/TransactionItem'
import { Card } from '../../components/ui/Card'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost/api'

// ─── Date range presets ───────────────────────────────────────────────────────
type Preset = 'this_month' | 'last_month' | 'last_3' | 'last_6' | 'this_year' | 'payday' | 'custom'

function getPresetRange(
  preset: Preset,
  custom?: { start: string; end: string },
  paydayDate?: number,
) {
  const now = new Date()
  switch (preset) {
    case 'this_month':
      return {
        startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
        label: format(now, 'MMMM yyyy', { locale: id }),
      }
    case 'last_month': {
      const last = subMonths(now, 1)
      return {
        startDate: format(startOfMonth(last), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(last), 'yyyy-MM-dd'),
        label: format(last, 'MMMM yyyy', { locale: id }),
      }
    }
    case 'last_3':
      return {
        startDate: format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
        label: '3 Bulan Terakhir',
      }
    case 'last_6':
      return {
        startDate: format(startOfMonth(subMonths(now, 5)), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
        label: '6 Bulan Terakhir',
      }
    case 'this_year':
      return {
        startDate: format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd'),
        endDate: format(new Date(now.getFullYear(), 11, 31), 'yyyy-MM-dd'),
        label: `Tahun ${now.getFullYear()}`,
      }
    case 'payday': {
      const day = paydayDate ?? 25
      // If today >= payday → period is this month's payday to next month's payday-1
      // If today < payday → period is last month's payday to this month's payday-1
      const todayDay = now.getDate()
      let periodStart: Date
      if (todayDay >= day) {
        periodStart = new Date(now.getFullYear(), now.getMonth(), day)
      } else {
        const prev = subMonths(now, 1)
        periodStart = new Date(prev.getFullYear(), prev.getMonth(), day)
      }
      const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, day - 1)
      return {
        startDate: format(periodStart, 'yyyy-MM-dd'),
        endDate: format(periodEnd, 'yyyy-MM-dd'),
        label: `Gajian ${day} (${format(periodStart, 'd MMM', { locale: id })} – ${format(periodEnd, 'd MMM', { locale: id })})`,
      }
    }
    case 'custom':
      return {
        startDate: custom?.start ?? format(startOfMonth(now), 'yyyy-MM-dd'),
        endDate: custom?.end ?? format(endOfMonth(now), 'yyyy-MM-dd'),
        label: custom
          ? `${format(new Date(custom.start), 'd MMM yyyy', { locale: id })} – ${format(new Date(custom.end), 'd MMM yyyy', { locale: id })}`
          : 'Custom',
      }
  }
}

// ─── % change badge ───────────────────────────────────────────────────────────
function ChangeBadge({ value }: { value: number | null | undefined }) {
  if (value == null) return null
  const abs = Math.abs(Math.round(value))
  if (value > 0) return (
    <View className="flex-row items-center bg-red-50 px-1.5 py-0.5 rounded-lg ml-2">
      <ArrowUpRight size={11} color="#ef4444" />
      <Text className="text-red-500 text-xs font-semibold ml-0.5">{abs}%</Text>
    </View>
  )
  if (value < 0) return (
    <View className="flex-row items-center bg-emerald-50 px-1.5 py-0.5 rounded-lg ml-2">
      <ArrowDownRight size={11} color="#10b981" />
      <Text className="text-emerald-600 text-xs font-semibold ml-0.5">{abs}%</Text>
    </View>
  )
  return (
    <View className="flex-row items-center bg-slate-50 px-1.5 py-0.5 rounded-lg ml-2">
      <Minus size={11} color="#94a3b8" />
      <Text className="text-slate-400 text-xs font-semibold ml-0.5">0%</Text>
    </View>
  )
}

// ─── Date Filter Modal ────────────────────────────────────────────────────────
function DateFilterModal({
  visible, current, paydayDate, onSelect, onClose,
}: {
  visible: boolean
  current: Preset
  paydayDate: number
  onSelect: (p: Preset, custom?: { start: string; end: string }, payday?: number) => void
  onClose: () => void
}) {
  const now = new Date()
  const [customStart, setCustomStart] = useState(format(startOfMonth(now), 'yyyy-MM-dd'))
  const [customEnd, setCustomEnd]     = useState(format(endOfMonth(now), 'yyyy-MM-dd'))
  const [showCustom, setShowCustom]   = useState(false)
  const [showPayday, setShowPayday]   = useState(false)
  const [paydayInput, setPaydayInput] = useState(String(paydayDate))

  const presets: { key: Preset; label: string; icon: string }[] = [
    { key: 'this_month', label: 'Bulan Ini',         icon: '📅' },
    { key: 'last_month', label: 'Bulan Lalu',         icon: '⬅️' },
    { key: 'last_3',     label: '3 Bulan Terakhir',   icon: '📊' },
    { key: 'last_6',     label: '6 Bulan Terakhir',   icon: '📈' },
    { key: 'this_year',  label: 'Tahun Ini',          icon: '🗓️' },
    { key: 'payday',     label: 'Periode Gajian',     icon: '💰' },
    { key: 'custom',     label: 'Pilih Tanggal',      icon: '✏️' },
  ]

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity className="flex-1 bg-black/40 justify-end" activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} className="bg-white rounded-t-3xl" onPress={() => {}}>
          <ScrollView>
            <View className="p-6">
              <View className="flex-row items-center justify-between mb-5">
                <Text className="text-lg font-bold text-slate-900">Filter Periode</Text>
                <TouchableOpacity onPress={onClose}><X size={20} color="#94a3b8" /></TouchableOpacity>
              </View>

              {presets.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => {
                    if (p.key === 'custom') { setShowCustom(true); setShowPayday(false) }
                    else if (p.key === 'payday') { setShowPayday(true); setShowCustom(false) }
                    else { onSelect(p.key); onClose() }
                  }}
                  className={`py-3.5 px-4 rounded-xl mb-2 flex-row items-center justify-between ${
                    current === p.key ? 'bg-primary/10' : 'bg-slate-50'
                  }`}
                >
                  <View className="flex-row items-center">
                    <Text className="mr-2.5" style={{ fontSize: 16 }}>{p.icon}</Text>
                    <Text className={`font-medium ${current === p.key ? 'text-primary' : 'text-slate-700'}`}>
                      {p.label}
                    </Text>
                  </View>
                  {current === p.key && <View className="w-2 h-2 rounded-full bg-primary" />}
                </TouchableOpacity>
              ))}

              {/* Payday period config */}
              {showPayday && (
                <View className="mt-1 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <Text className="text-xs font-semibold text-amber-700 mb-3">
                    💰 Tanggal Gajian Kamu
                  </Text>
                  <Text className="text-xs text-amber-600 mb-3">
                    Masukkan tanggal gajianmu (1–28). Periode otomatis dihitung dari tanggal itu.
                  </Text>
                  <View className="flex-row items-center gap-3 mb-3">
                    <Text className="text-slate-700 text-sm font-medium">Tanggal:</Text>
                    {/* HTML native number input */}
                    <View className="flex-1 bg-white border border-amber-300 rounded-xl overflow-hidden">
                      {typeof window !== 'undefined' ? (
                        <input
                          type="number"
                          min={1} max={28}
                          value={paydayInput}
                          onChange={(e) => setPaydayInput(e.target.value)}
                          style={{
                            width: '100%', padding: '10px 14px',
                            border: 'none', outline: 'none',
                            fontSize: 14, color: '#1e293b',
                            backgroundColor: 'transparent',
                          }}
                        />
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      const day = Math.min(28, Math.max(1, parseInt(paydayInput) || 25))
                      onSelect('payday', undefined, day)
                      onClose()
                    }}
                    className="bg-amber-500 rounded-xl py-3 items-center"
                  >
                    <Text className="text-white font-bold">Terapkan Periode Gajian</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Custom date range with HTML date picker */}
              {showCustom && (
                <View className="mt-1 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <Text className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">
                    Pilih Rentang Tanggal
                  </Text>
                  <View className="flex-row gap-3 mb-3">
                    <View className="flex-1">
                      <Text className="text-xs text-slate-500 mb-1.5 font-medium">Dari</Text>
                      <View className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        {typeof window !== 'undefined' ? (
                          <input
                            type="date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            style={{
                              width: '100%', padding: '10px 12px',
                              border: 'none', outline: 'none',
                              fontSize: 13, color: '#1e293b',
                              backgroundColor: 'transparent',
                            }}
                          />
                        ) : null}
                      </View>
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs text-slate-500 mb-1.5 font-medium">Sampai</Text>
                      <View className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        {typeof window !== 'undefined' ? (
                          <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            style={{
                              width: '100%', padding: '10px 12px',
                              border: 'none', outline: 'none',
                              fontSize: 13, color: '#1e293b',
                              backgroundColor: 'transparent',
                            }}
                          />
                        ) : null}
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      if (customStart && customEnd) {
                        onSelect('custom', { start: customStart, end: customEnd })
                        onClose()
                      }
                    }}
                    className="bg-primary rounded-xl py-3 items-center"
                  >
                    <Text className="text-white font-bold">Terapkan</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View className="h-4" />
            </View>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [preset, setPreset] = useState<Preset>('this_month')
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | undefined>()
  const [paydayDate, setPaydayDate] = useState(25)

  const range = getPresetRange(preset, customRange, paydayDate)

  const handlePresetSelect = (p: Preset, custom?: { start: string; end: string }, payday?: number) => {
    setPreset(p)
    if (p === 'custom' && custom) setCustomRange(custom)
    if (p === 'payday' && payday) setPaydayDate(payday)
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  // Check whether user has any active email integration
  // staleTime=0 so it always re-checks when dashboard mounts (e.g. after Gmail connect redirect)
  const { data: integrations } = useQuery({
    queryKey: ['email-integrations'],
    queryFn: () => api.get<{ id: string; isActive: boolean }[]>('/email-integrations'),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })
  const hasEmailIntegration = (integrations?.data?.length ?? 0) > 0
  const showGmailBanner = !hasEmailIntegration && !bannerDismissed

  const handleConnectGmail = async () => {
    try {
      const { data } = await api.get<{ url: string }>('/email-integrations/gmail/auth')
      if (typeof window !== 'undefined') {
        window.location.href = data.url
      } else {
        Linking.openURL(data.url)
      }
    } catch {
      // silently ignore — user can try from Email tab
    }
  }

  const { data: summary, isLoading: summaryLoading } = useDashboardSummary({
    startDate: range.startDate,
    endDate: range.endDate,
  })
  const { data: categoryData, isLoading: categoryLoading } = useCategoryBreakdown({
    startDate: range.startDate,
    endDate: range.endDate,
    type: 'expense',
  })
  const { data: trendData, isLoading: trendLoading } = useMonthlyTrend(6)
  const { data: recentData, isLoading: recentLoading } = useTransactions({ limit: 5, page: 1 })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    await queryClient.invalidateQueries({ queryKey: ['transactions'] })
    setRefreshing(false)
  }, [queryClient])

  const greeting = getGreeting()

  // % change values from API
  const incomeChange = summary?.incomeChange as number | null | undefined
  const expenseChange = summary?.expenseChange as number | null | undefined
  const netChange = summary?.netBalanceChange as number | null | undefined

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A2B4A"
            colors={['#1A2B4A']}
          />
        }
      >
        {/* Header */}
        <View className="bg-primary px-5 pt-4 pb-8">
          <View className="flex-row items-center justify-between mb-1">
            <View>
              <Text className="text-white/70 text-sm">{greeting},</Text>
              <Text className="text-white text-xl font-bold mt-0.5">
                {user?.name?.split(' ')[0] ?? 'Pengguna'}
              </Text>
            </View>
            <TouchableOpacity className="w-10 h-10 bg-white/10 rounded-full items-center justify-center">
              <Bell size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Date filter chip */}
          <TouchableOpacity
            onPress={() => setShowDateFilter(true)}
            className="flex-row items-center self-start mt-2 bg-white/15 rounded-full px-3 py-1.5"
          >
            <Calendar size={13} color="rgba(255,255,255,0.8)" />
            <Text className="text-white/80 text-xs font-medium mx-2">{range.label}</Text>
            <ChevronDown size={13} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>

        {/* Gmail integration banner */}
        {showGmailBanner && (
          <View className="mx-4 mt-4 rounded-2xl overflow-hidden"
            style={{ backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE' }}
          >
            <View className="p-4">
              <View className="flex-row items-start justify-between">
                <View className="flex-row items-center flex-1 mr-3">
                  <View className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                    style={{ backgroundColor: '#6366F1' }}
                  >
                    <Zap size={20} color="white" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-sm" style={{ color: '#3730A3' }}>
                      Aktifkan Auto-Import Transaksi
                    </Text>
                    <Text className="text-xs mt-0.5 leading-4" style={{ color: '#6366F1' }}>
                      Hubungkan Gmail agar transaksi masuk otomatis
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setBannerDismissed(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={16} color="#6366F1" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={handleConnectGmail}
                activeOpacity={0.85}
                className="mt-3 rounded-xl py-2.5 items-center flex-row justify-center"
                style={{ backgroundColor: '#6366F1' }}
              >
                <Mail size={15} color="white" />
                <Text className="text-white font-bold text-sm ml-2">Hubungkan Gmail Sekarang</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setBannerDismissed(true)} className="mt-2 items-center py-1">
                <Text className="text-xs" style={{ color: '#818CF8' }}>Ingatkan saya nanti</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Summary cards */}
        <View className={`mx-4 ${showGmailBanner ? 'mt-4' : '-mt-4'}`}>
          <Card variant="elevated" padding="md">
            {summaryLoading ? <LoadingSpinner /> : (
              <>
                {/* Net balance */}
                <View className="mb-3">
                  <Text className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">
                    Saldo Bersih
                  </Text>
                  <View className="flex-row items-center">
                    <Text className={`text-3xl font-bold font-mono ${
                      (summary?.netBalance ?? 0) >= 0 ? 'text-primary' : 'text-red-500'
                    }`}>
                      {formatCurrency(summary?.netBalance ?? 0)}
                    </Text>
                    <ChangeBadge value={netChange} />
                  </View>
                  {summary?.previousPeriod && (
                    <Text className="text-slate-400 text-xs mt-1">
                      vs {formatCurrencyCompact(summary.previousPeriod.netBalance ?? 0)} periode lalu
                    </Text>
                  )}
                </View>

                {/* Income / Expense row */}
                <View className="flex-row gap-3">
                  <View className="flex-1 bg-emerald-50 rounded-xl p-3">
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-xs text-emerald-700 font-medium">Pemasukan</Text>
                      <ChangeBadge value={incomeChange} />
                    </View>
                    <Text className="text-base font-bold text-emerald-700 font-mono">
                      {formatCurrencyCompact(summary?.totalIncome ?? 0)}
                    </Text>
                  </View>
                  <View className="flex-1 bg-red-50 rounded-xl p-3">
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-xs text-red-600 font-medium">Pengeluaran</Text>
                      <ChangeBadge value={expenseChange} />
                    </View>
                    <Text className="text-base font-bold text-red-600 font-mono">
                      {formatCurrencyCompact(summary?.totalExpense ?? 0)}
                    </Text>
                  </View>
                </View>

                {/* Transaction count */}
                <Text className="text-slate-400 text-xs mt-2 text-right">
                  {summary?.transactionCount ?? 0} transaksi
                </Text>
              </>
            )}
          </Card>
        </View>

        <View className="px-4 mt-5 gap-5">
          {/* Category Breakdown */}
          <Card padding="md">
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-slate-800 font-bold text-base">Pengeluaran per Kategori</Text>
                <Text className="text-slate-400 text-xs mt-0.5">{range.label}</Text>
              </View>
              <View className="bg-red-50 px-2 py-1 rounded-lg">
                <TrendingDown size={14} color="#EF4444" />
              </View>
            </View>
            {categoryLoading ? <LoadingSpinner /> : <CategoryPieChart data={categoryData ?? []} />}
          </Card>

          {/* Monthly Trend */}
          <Card padding="md">
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-slate-800 font-bold text-base">Tren 6 Bulan Terakhir</Text>
                <Text className="text-slate-400 text-xs mt-0.5">Pemasukan vs Pengeluaran</Text>
              </View>
              <View className="bg-emerald-50 px-2 py-1 rounded-lg">
                <TrendingUp size={14} color="#10B981" />
              </View>
            </View>
            {trendLoading ? <LoadingSpinner /> : <MonthlyBarChart data={trendData ?? []} />}
          </Card>

          {/* Recent Transactions */}
          <Card padding="none">
            <View className="flex-row items-center justify-between px-4 pt-4 pb-3">
              <View>
                <Text className="text-slate-800 font-bold text-base">Transaksi Terbaru</Text>
                <Text className="text-slate-400 text-xs mt-0.5">5 transaksi terakhir</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/transactions')}
                className="flex-row items-center"
              >
                <Text className="text-primary text-sm font-medium">Lihat semua</Text>
                <ChevronRight size={14} color="#1A2B4A" />
              </TouchableOpacity>
            </View>

            {recentLoading ? <LoadingSpinner /> : recentData?.data && recentData.data.length > 0 ? (
              <View>
                {recentData.data.map((transaction, idx) => (
                  <View key={transaction.id}>
                    <TransactionItem
                      transaction={transaction}
                      onPress={() => router.push('/(tabs)/transactions')}
                    />
                    {idx < recentData.data.length - 1 && <View className="h-px bg-slate-50 mx-4" />}
                  </View>
                ))}
                <View className="h-2" />
              </View>
            ) : (
              <View className="py-10 items-center">
                <Text className="text-slate-400 text-sm">Belum ada transaksi</Text>
                <Text className="text-slate-300 text-xs mt-1">Tambahkan transaksi pertamamu</Text>
              </View>
            )}
          </Card>

          {/* Quick insight */}
          {summary && summary.totalExpense > 0 && summary.totalIncome > 0 && (
            <Card padding="md" className="bg-primary/5 border border-primary/10">
              <View className="flex-row items-start">
                <View className="w-8 h-8 bg-primary/10 rounded-xl items-center justify-center mr-3 mt-0.5">
                  <TrendingUp size={16} color="#1A2B4A" />
                </View>
                <View className="flex-1">
                  <Text className="text-primary font-semibold text-sm">Insight Periode Ini</Text>
                  <Text className="text-slate-500 text-sm mt-1 leading-5">
                    {summary.netBalance >= 0
                      ? `Kamu menabung ${formatCurrency(summary.netBalance)}. `
                      : `Pengeluaran melebihi pemasukan ${formatCurrency(Math.abs(summary.netBalance))}. `}
                    Rasio pengeluaran:{' '}
                    <Text className="font-semibold text-slate-700">
                      {Math.round((summary.totalExpense / summary.totalIncome) * 100)}%
                    </Text>
                    {' '}dari pemasukan.
                  </Text>
                </View>
              </View>
            </Card>
          )}

          <View className="h-4" />
        </View>
      </ScrollView>

      {/* Date filter modal */}
      <DateFilterModal
        visible={showDateFilter}
        current={preset}
        paydayDate={paydayDate}
        onSelect={handlePresetSelect}
        onClose={() => setShowDateFilter(false)}
      />
    </SafeAreaView>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}
