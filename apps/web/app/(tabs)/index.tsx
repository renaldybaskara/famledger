import { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { Bell, TrendingUp, TrendingDown, ChevronRight, Mail, X, Zap } from 'lucide-react'
import { router } from 'expo-router'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useDashboardSummary, useCategoryBreakdown, useMonthlyTrend } from '../../src/hooks/useDashboard'
import { useTransactions } from '../../src/hooks/useTransactions'
import { useAuthStore } from '../../src/store/auth.store'
import { api } from '../../src/lib/api'
import { getCurrentMonthRange, formatCurrency } from '../../src/lib/format'
import { SummaryCard } from '../../components/dashboard/SummaryCard'
import { CategoryPieChart } from '../../components/dashboard/CategoryPieChart'
import { MonthlyBarChart } from '../../components/dashboard/MonthlyBarChart'
import { TransactionItem } from '../../components/transactions/TransactionItem'
import { Card } from '../../components/ui/Card'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost/api'

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const range = getCurrentMonthRange()

  // Check whether user has any active email integration
  const { data: integrations } = useQuery({
    queryKey: ['email-integrations'],
    queryFn: () => api.get<{ id: string; isActive: boolean }[]>('/email-integrations'),
    staleTime: 5 * 60 * 1000,
  })
  const hasEmailIntegration = (integrations?.data?.length ?? 0) > 0
  const showGmailBanner = !hasEmailIntegration && !bannerDismissed

  const handleConnectGmail = () => {
    if (typeof window !== 'undefined') {
      window.location.href = `${API_URL}/email-integrations/gmail/auth`
    } else {
      Linking.openURL(`${API_URL}/email-integrations/gmail/auth`)
    }
  }

  const { data: summary, isLoading: summaryLoading } = useDashboardSummary(range)
  const { data: categoryData, isLoading: categoryLoading } = useCategoryBreakdown({
    ...range,
    type: 'expense',
  })
  const { data: trendData, isLoading: trendLoading } = useMonthlyTrend(6)
  const { data: recentData, isLoading: recentLoading } = useTransactions({
    limit: 5,
    page: 1,
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    await queryClient.invalidateQueries({ queryKey: ['transactions'] })
    setRefreshing(false)
  }, [queryClient])

  const currentMonth = format(new Date(), 'MMMM yyyy', { locale: id })
  const greeting = getGreeting()

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
          <Text className="text-white/60 text-xs mt-1">{currentMonth}</Text>
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
                      Hubungkan Gmail agar transaksi bank & e-wallet masuk otomatis
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setBannerDismissed(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
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
                <Text className="text-white font-bold text-sm ml-2">
                  Hubungkan Gmail Sekarang
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setBannerDismissed(true)}
                className="mt-2 items-center py-1"
              >
                <Text className="text-xs" style={{ color: '#818CF8' }}>
                  Ingatkan saya nanti
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Summary cards — overlapping header */}
        <View className={`mx-4 ${showGmailBanner ? 'mt-4' : '-mt-4'}`}>
          <Card variant="elevated" padding="md">
            {summaryLoading ? (
              <LoadingSpinner />
            ) : (
              <>
                {/* Net balance — large */}
                <View className="mb-3">
                  <Text className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">
                    Saldo Bersih Bulan Ini
                  </Text>
                  <Text
                    className={`text-3xl font-bold font-mono ${
                      (summary?.netBalance ?? 0) >= 0 ? 'text-primary' : 'text-expense'
                    }`}
                  >
                    {formatCurrency(summary?.netBalance ?? 0)}
                  </Text>
                </View>

                {/* Income / Expense */}
                <View className="flex-row gap-3">
                  <SummaryCard
                    title="Pemasukan"
                    amount={summary?.totalIncome ?? 0}
                    variant="income"
                    subtitle={`${summary?.transactionCount ?? 0} transaksi`}
                  />
                  <SummaryCard
                    title="Pengeluaran"
                    amount={summary?.totalExpense ?? 0}
                    variant="expense"
                  />
                </View>
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
                <Text className="text-slate-400 text-xs mt-0.5">{currentMonth}</Text>
              </View>
              <View className="bg-red-50 px-2 py-1 rounded-lg">
                <TrendingDown size={14} color="#EF4444" />
              </View>
            </View>
            {categoryLoading ? (
              <LoadingSpinner />
            ) : (
              <CategoryPieChart data={categoryData ?? []} />
            )}
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
            {trendLoading ? (
              <LoadingSpinner />
            ) : (
              <MonthlyBarChart data={trendData ?? []} />
            )}
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

            {recentLoading ? (
              <LoadingSpinner />
            ) : recentData?.data && recentData.data.length > 0 ? (
              <View>
                {recentData.data.map((transaction, idx) => (
                  <View key={transaction.id}>
                    <TransactionItem
                      transaction={transaction}
                      onPress={() => router.push('/(tabs)/transactions')}
                    />
                    {idx < recentData.data.length - 1 && (
                      <View className="h-px bg-slate-50 mx-4" />
                    )}
                  </View>
                ))}
                <View className="h-2" />
              </View>
            ) : (
              <View className="py-10 items-center">
                <Text className="text-slate-400 text-sm">Belum ada transaksi</Text>
                <Text className="text-slate-300 text-xs mt-1">
                  Tambahkan transaksi pertamamu
                </Text>
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
                  <Text className="text-primary font-semibold text-sm">Insight Bulan Ini</Text>
                  <Text className="text-slate-500 text-sm mt-1 leading-5">
                    {summary.netBalance >= 0
                      ? `Kamu berhasil menabung ${formatCurrency(summary.netBalance)} bulan ini. `
                      : `Pengeluaranmu melebihi pemasukan sebesar ${formatCurrency(Math.abs(summary.netBalance))}. `}
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
