import { useState, useCallback, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  FlatList, RefreshControl, Alert, Platform, Share, Modal, Pressable,
} from 'react-native'
import { Download, SlidersHorizontal, Search, X } from 'lucide-react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTransactions, useDeleteTransaction } from '../../src/hooks/useTransactions'
import { api } from '../../src/lib/api'
import { Transaction, TransactionType } from '../../src/lib/api'
import { formatDateShort } from '../../src/lib/format'
import { TransactionItem } from '../../components/transactions/TransactionItem'
import { AddTransactionModal } from '../../components/transactions/AddTransactionModal'
import { TransactionDetailModal } from '../../components/transactions/TransactionDetailModal'
import { PaymentSlipScanModal } from '../../components/transactions/PaymentSlipScanModal'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { PeriodModal, getPresetRange, type Preset } from '../../components/ui/PeriodModal'
import { useTheme } from '../../src/lib/theme'

type TypeFilter = '' | TransactionType

const TYPE_FILTERS: Array<{ value: TypeFilter; label: string }> = [
  { value: '',         label: 'Semua'    },
  { value: 'income',   label: 'Masuk'    },
  { value: 'expense',  label: 'Keluar'   },
  { value: 'transfer', label: 'Transfer' },
]

interface GroupedTransactions {
  date: string
  data: Transaction[]
}

function groupTransactionsByDate(transactions: Transaction[]): GroupedTransactions[] {
  const groups: Record<string, Transaction[]> = {}
  for (const t of transactions) {
    const date = t.date.split('T')[0]
    if (!groups[date]) groups[date] = []
    groups[date].push(t)
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, data]) => ({ date, data }))
}

function fmtIDR(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)
}

export default function TransactionsScreen() {
  const C = useTheme()
  const queryClient = useQueryClient()
  const [search, setSearch]           = useState('')
  const [typeFilter, setTypeFilter]   = useState<TypeFilter>('')
  const [showFilters, setShowFilters] = useState(false)
  const [addModalVisible, setAddModalVisible]       = useState(false)
  const [scanModalVisible, setScanModalVisible]     = useState(false)
  const [detailTransaction, setDetailTransaction]   = useState<Transaction | null>(null)
  const [refreshing, setRefreshing]                 = useState(false)
  const [page, setPage]                             = useState(1)
  const [selectedWsId, setSelectedWsId]             = useState<string | null>(null)
  const [showPeriod, setShowPeriod]                 = useState(false)
  const [preset, setPreset]                         = useState<Preset>('this_month')
  const [customRange, setCustomRange]               = useState<{ start: string; end: string } | undefined>()
  const [paydayDate, setPaydayDate]                 = useState(25)

  const range = getPresetRange(preset, customRange, paydayDate)

  const handlePresetSelect = (p: Preset, custom?: { start: string; end: string }, payday?: number) => {
    setPreset(p)
    if (p === 'custom' && custom) setCustomRange(custom)
    if (p === 'payday' && payday) setPaydayDate(payday)
    setPage(1)
    setWsPage(1)
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['ws-transactions-tab'] })
  }

  const { data: workspacesData } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get<any[]>('/workspaces').then(r => r.data ?? []),
  })
  const workspaces = workspacesData ?? []

  const { data, isLoading, isFetching } = useTransactions({
    page, limit: 50,
    type: typeFilter || undefined,
    search: search.length >= 2 ? search : undefined,
    startDate: range.startDate,
    endDate:   range.endDate,
  })

  const [wsPage, setWsPage] = useState(1)
  const WS_LIMIT = 200

  const { data: wsTxData, isLoading: wsTxLoading } = useQuery({
    queryKey: ['ws-transactions-tab', selectedWsId, typeFilter, search, range.startDate, range.endDate, wsPage],
    queryFn: () => api.get<any>(`/workspaces/${selectedWsId}/transactions`, {
      params: {
        page: wsPage,
        limit: WS_LIMIT,
        type: typeFilter || undefined,
        search: search.length >= 2 ? search : undefined,
        startDate: range.startDate,
        endDate: range.endDate,
      },
    }).then(r => r.data),
    enabled: !!selectedWsId,
  })

  const deleteMutation = useDeleteTransaction()

  const activeTransactions: Transaction[] = selectedWsId
    ? (wsTxData?.data ?? [])
    : (data?.data ?? [])
  const total      = selectedWsId ? (wsTxData?.pagination?.total ?? 0) : (data?.total ?? 0)
  const totalPages = selectedWsId ? (wsTxData?.pagination?.totalPages ?? 1) : 1
  const loading    = selectedWsId ? wsTxLoading : isLoading
  const transactions = activeTransactions
  const grouped      = useMemo(() => groupTransactionsByDate(transactions), [transactions])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    setWsPage(1)
    await queryClient.invalidateQueries({ queryKey: ['transactions'] })
    await queryClient.invalidateQueries({ queryKey: ['ws-transactions-tab'] })
    setRefreshing(false)
  }, [queryClient])

  const handleExportCSV = async () => {
    if (transactions.length === 0) return
    const headers = ['Tanggal','Tipe','Jumlah','Kategori','Merchant','Catatan','Rekening','Sumber']
    const rows = transactions.map((t) => [
      new Date(t.date).toLocaleDateString('id-ID'),
      t.type === 'income' ? 'Pemasukan' : t.type === 'expense' ? 'Pengeluaran' : 'Transfer',
      t.amount,
      t.category?.name ?? '',
      t.merchant ?? '',
      (t as any).description ?? '',
      t.account?.name ?? '',
      (t as any).source ?? 'manual',
    ])
    const csv = '﻿' + [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')

    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `transaksi-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      await Share.share({ message: csv, title: 'Export Transaksi' })
    }
  }

  const handleDelete = (transaction: Transaction) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Hapus transaksi "${transaction.merchant || transaction.category?.name}"?`)) {
        deleteMutation.mutate(transaction.id)
      }
    } else {
      Alert.alert('Hapus Transaksi', `Yakin hapus "${transaction.merchant || transaction.category?.name}"?`, [
        { text: 'Batal', style: 'cancel' },
        { text: 'Hapus', style: 'destructive', onPress: () => deleteMutation.mutate(transaction.id) },
      ])
    }
  }

  const renderGroup = ({ item }: { item: GroupedTransactions }) => {
    const incomeSum  = item.data.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenseSum = item.data.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

    return (
      <View style={{ marginBottom: 4 }}>
        {/* Day header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20, paddingVertical: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: C.fg3, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Inter_800ExtraBold' }}>
            {formatDateShort(item.date)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {incomeSum > 0 && (
              <Text style={{ fontSize: 12, fontWeight: '800', color: C.income, fontFamily: 'Inter_800ExtraBold', fontVariant: ['tabular-nums'] as any }}>
                +{fmtIDR(incomeSum)}
              </Text>
            )}
            {expenseSum > 0 && (
              <Text style={{ fontSize: 12, fontWeight: '800', color: C.expense, fontFamily: 'Inter_800ExtraBold', fontVariant: ['tabular-nums'] as any }}>
                -{fmtIDR(expenseSum)}
              </Text>
            )}
          </View>
        </View>

        {/* Transaction group cards */}
        <View style={{ marginHorizontal: 16, gap: 4 }}>
          {item.data.map((txn) => (
            <View key={txn.id} style={{ borderRadius: 16, overflow: 'hidden', shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
              <TransactionItem
                transaction={txn}
                showDate={false}
                memberName={selectedWsId ? (txn as any).memberName : undefined}
                onLongPress={() => handleDelete(txn)}
                onPress={() => setDetailTransaction(txn)}
              />
            </View>
          ))}
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      {/* Header */}
      <View style={{ backgroundColor: C.cream, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <View>
            <Text style={{ fontSize: 26, fontWeight: '900', color: C.fg1, letterSpacing: -0.5, fontFamily: 'Inter_900Black' }}>Transaksi</Text>
            {total > 0 && (
              <Text style={{ fontSize: 13, fontWeight: '500', color: C.fg3, marginTop: 2, fontFamily: 'Inter_500Medium' }}>
                {total} transaksi
              </Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {transactions.length > 0 && (
              <TouchableOpacity
                onPress={handleExportCSV}
                style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}
              >
                <Download size={16} color={C.primary} strokeWidth={2} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setScanModalVisible(true)}
              style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#F4DDD0', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="2" width="14" height="18" rx="2" fill="none" stroke={C.accent} strokeWidth="1.8" />
                <line x1="8" y1="7" x2="16" y2="7" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" />
                <line x1="8" y1="10.5" x2="16" y2="10.5" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" />
                <line x1="8" y1="14" x2="12" y2="14" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" />
                <path d="M2 11.5 L22 11.5" fill="none" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" style={{ opacity: 0.6 } as any} />
              </svg>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowFilters((v) => !v)}
              style={{
                width: 38, height: 38, borderRadius: 12,
                backgroundColor: showFilters ? C.primary : C.surface,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: showFilters ? C.primary : C.border,
              }}
            >
              <SlidersHorizontal size={16} color={showFilters ? '#fff' : C.fg1} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Period pills — same as dashboard */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {([
            { key: 'this_month' as Preset, label: 'Bulan ini' },
            { key: 'payday'     as Preset, label: 'Gajian' },
            { key: 'custom'     as Preset, label: 'Custom', isCustom: true },
          ] as Array<{ key: Preset; label: string; isCustom?: boolean }>).map(({ key, label, isCustom }) => (
            <TouchableOpacity
              key={key}
              onPress={() => key === 'custom' ? setShowPeriod(true) : handlePresetSelect(key)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
                backgroundColor: preset === key ? C.primary : C.surface,
                borderWidth: 1.5, borderColor: preset === key ? C.primary : C.border,
              }}
            >
              {isCustom && Platform.OS === 'web' && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke={preset === key ? '#fff' : C.fg2} strokeWidth="2" />
                  <line x1="16" y1="2" x2="16" y2="6" stroke={preset === key ? '#fff' : C.fg2} strokeWidth="2" strokeLinecap="round" />
                  <line x1="8" y1="2" x2="8" y2="6" stroke={preset === key ? '#fff' : C.fg2} strokeWidth="2" strokeLinecap="round" />
                  <line x1="3" y1="10" x2="21" y2="10" stroke={preset === key ? '#fff' : C.fg2} strokeWidth="2" />
                </svg>
              )}
              <Text style={{ fontSize: 12, fontWeight: '600', color: preset === key ? '#fff' : C.fg2, fontFamily: 'Inter_600SemiBold' }}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: C.surface, borderRadius: 14,
          paddingHorizontal: 14, paddingVertical: 12,
          borderWidth: 1, borderColor: C.border,
          gap: 10,
        }}>
          <Search size={16} color={C.fg3} strokeWidth={2} />
          <TextInput
            style={{ flex: 1, fontSize: 15, fontWeight: '600', color: C.fg1, fontFamily: 'Inter_600SemiBold' }}
            placeholder="Cari transaksi..."
            placeholderTextColor={C.fg4}
            value={search}
            onChangeText={(v) => { setSearch(v); setPage(1) }}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setPage(1) }}>
              <X size={14} color={C.fg4} strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>

        {/* Active filter pills summary */}
        {(typeFilter !== '' || selectedWsId !== null) && (
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {typeFilter !== '' && (
              <TouchableOpacity
                onPress={() => { setTypeFilter(''); setPage(1) }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: C.primary + '22' }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.primary, fontFamily: 'Inter_700Bold' }}>
                  {TYPE_FILTERS.find(f => f.value === typeFilter)?.label}
                </Text>
                <X size={10} color={C.primary} strokeWidth={2.5} />
              </TouchableOpacity>
            )}
            {selectedWsId !== null && (
              <TouchableOpacity
                onPress={() => setSelectedWsId(null)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: C.primary + '22' }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.primary, fontFamily: 'Inter_700Bold' }}>
                  {workspaces.find((w: any) => w.id === selectedWsId)?.name ?? 'Workspace'}
                </Text>
                <X size={10} color={C.primary} strokeWidth={2.5} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Filter popup modal */}
      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={() => setShowFilters(false)}>
          <Pressable onPress={e => e.stopPropagation()}>
            <View style={{ backgroundColor: '#FAF7F2', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0DBD2', alignSelf: 'center', marginBottom: 20 }} />
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#2D2A26', fontFamily: 'Inter_900Black', marginBottom: 20 }}>Filter Transaksi</Text>

              {/* Type filter */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#8E887F', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Inter_700Bold', marginBottom: 10 }}>Tipe Transaksi</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {TYPE_FILTERS.map((f) => {
                  const active = typeFilter === f.value
                  return (
                    <TouchableOpacity
                      key={f.value}
                      onPress={() => { setTypeFilter(f.value); setPage(1) }}
                      style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? C.primary : C.surface, borderWidth: 1.5, borderColor: active ? C.primary : C.border }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold', color: active ? '#fff' : C.fg2 }}>{f.label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Workspace filter */}
              {workspaces.length > 0 && (
                <>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#8E887F', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Inter_700Bold', marginBottom: 10 }}>Tampilkan Dari</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                    <TouchableOpacity
                      onPress={() => setSelectedWsId(null)}
                      style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: !selectedWsId ? C.primary : C.surface, borderWidth: 1.5, borderColor: !selectedWsId ? C.primary : C.border }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '700', color: !selectedWsId ? '#fff' : C.fg2, fontFamily: 'Inter_700Bold' }}>Pribadi</Text>
                    </TouchableOpacity>
                    {workspaces.map((ws: any) => {
                      const active = selectedWsId === ws.id
                      return (
                        <TouchableOpacity key={ws.id} onPress={() => setSelectedWsId(active ? null : ws.id)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? C.primary : C.surface, borderWidth: 1.5, borderColor: active ? C.primary : C.border }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: active ? '#fff' : C.fg2, fontFamily: 'Inter_700Bold' }}>{ws.name}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </>
              )}

              <TouchableOpacity
                onPress={() => setShowFilters(false)}
                style={{ backgroundColor: C.primary, borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', fontFamily: 'Inter_800ExtraBold' }}>Terapkan Filter</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Summary card */}
      {!loading && transactions.length > 0 && (() => {
        const inc = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
        const exp = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
        const net = inc - exp
        return (
          <View style={{
            marginHorizontal: 16, marginBottom: 8, borderRadius: 20, padding: 16, overflow: 'hidden',
            backgroundColor: '#3D7A56',
            ...(({ background: 'linear-gradient(160deg, #3D7A56 0%, #41594F 100%)' }) as any),
          }}>
            <View style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff', fontFamily: 'Inter_900Black', fontVariant: ['tabular-nums'] as any }}>
                  {net >= 0 ? '+' : '-'}{fmtIDR(Math.abs(net))}
                </Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontFamily: 'Inter_500Medium' }}>
                  {range.label}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                {inc > 0 && (
                  <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(180,255,180,0.9)', fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] as any }}>
                    ↑ Masuk {fmtIDR(inc)}
                  </Text>
                )}
                {exp > 0 && (
                  <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(255,200,180,0.9)', fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] as any }}>
                    ↓ Keluar {fmtIDR(exp)}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )
      })()}

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <LoadingSpinner />
        </View>
      ) : grouped.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🧾</Text>
          <Text style={{ fontSize: 17, fontWeight: '800', color: C.fg2, fontFamily: 'Inter_800ExtraBold', textAlign: 'center' }}>
            {search ? `Tidak ditemukan "${search}"` : 'Belum ada transaksi'}
          </Text>
          <Text style={{ fontSize: 14, color: C.fg3, marginTop: 6, textAlign: 'center', fontFamily: 'Inter_500Medium' }}>
            {search ? 'Coba kata kunci lain' : 'Tambahkan transaksi pertamamu'}
          </Text>
          {!search && (
            <TouchableOpacity
              onPress={() => setAddModalVisible(true)}
              style={{
                marginTop: 20, backgroundColor: C.primary, borderRadius: 14,
                paddingHorizontal: 24, paddingVertical: 12,
                flexDirection: 'row', alignItems: 'center', gap: 8,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 18, lineHeight: 22 }}>+</Text>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, fontFamily: 'Inter_800ExtraBold' }}>Tambah Transaksi</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(item) => item.date}
          renderItem={renderGroup}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />
          }
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            selectedWsId && wsPage < totalPages ? (
              <TouchableOpacity
                onPress={() => setWsPage(p => p + 1)}
                style={{ marginHorizontal: 16, marginBottom: 16, padding: 14, borderRadius: 14, backgroundColor: C.primarySoft, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.primary, fontFamily: 'Inter_700Bold' }}>
                  Muat lebih banyak ({transactions.length} / {total})
                </Text>
              </TouchableOpacity>
            ) : isFetching && !refreshing
              ? <View style={{ padding: 16, alignItems: 'center' }}><Text style={{ color: C.fg4, fontSize: 13 }}>Memuat...</Text></View>
              : null
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={() => setAddModalVisible(true)}
        style={{
          position: 'absolute', bottom: 24, right: 20,
          width: 56, height: 56,
          backgroundColor: C.primary, borderRadius: 18,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.25, shadowRadius: 16, elevation: 10,
        }}
        activeOpacity={0.88}
      >
        <Text style={{ color: '#fff', fontSize: 28, lineHeight: 32, marginTop: -2 }}>+</Text>
      </TouchableOpacity>

      <AddTransactionModal visible={addModalVisible} onClose={() => setAddModalVisible(false)} />

      <PaymentSlipScanModal visible={scanModalVisible} onClose={() => setScanModalVisible(false)} />

      <TransactionDetailModal
        transaction={detailTransaction}
        visible={detailTransaction !== null}
        onClose={() => setDetailTransaction(null)}
        onDeleted={() => setDetailTransaction(null)}
      />

      <PeriodModal
        visible={showPeriod}
        current={preset}
        paydayDate={paydayDate}
        onSelect={handlePresetSelect}
        onClose={() => setShowPeriod(false)}
      />
    </SafeAreaView>
  )
}
