import { useState, useCallback, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  FlatList, RefreshControl, Alert, Platform, Share,
} from 'react-native'
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

// ── Saku tokens ───────────────────────────────────────────────
const C = {
  cream:       '#FAF7F2',
  creamSunken: '#F4EEE3',
  surface:     '#FFFFFF',
  primary:     '#6B8E6B',
  primarySoft: '#DEE8D7',
  heroEnd:     '#41594F',
  accent:      '#C97B5C',
  income:      '#6B8E6B',
  expense:     '#C97B5C',
  fg1:         '#2D2A26',
  fg2:         '#55504A',
  fg3:         '#8E887F',
  fg4:         '#A8A39B',
  border:      '#E0DBD2',
  divider:     '#ECE4D3',
}

type TypeFilter = '' | TransactionType

const TYPE_FILTERS: Array<{ value: TypeFilter; label: string }> = [
  { value: '',         label: 'Semua'    },
  { value: 'expense',  label: 'Keluar'   },
  { value: 'income',   label: 'Masuk'    },
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
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
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

  const { data: wsTxData, isLoading: wsTxLoading } = useQuery({
    queryKey: ['ws-transactions-tab', selectedWsId, typeFilter, search, range.startDate, range.endDate],
    queryFn: () => api.get<any>(`/workspaces/${selectedWsId}/transactions`, {
      params: {
        limit: 50,
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
  const total   = selectedWsId ? (wsTxData?.pagination?.total ?? 0) : (data?.total ?? 0)
  const loading = selectedWsId ? wsTxLoading : isLoading
  const transactions = activeTransactions
  const grouped      = useMemo(() => groupTransactionsByDate(transactions), [transactions])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['transactions'] })
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
          <Text style={{ fontSize: 12, fontWeight: '800', color: C.fg3, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Nunito_800ExtraBold' }}>
            {formatDateShort(item.date)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {incomeSum > 0 && (
              <Text style={{ fontSize: 12, fontWeight: '800', color: C.income, fontFamily: 'Nunito_800ExtraBold', fontVariant: ['tabular-nums'] as any }}>
                +{fmtIDR(incomeSum)}
              </Text>
            )}
            {expenseSum > 0 && (
              <Text style={{ fontSize: 12, fontWeight: '800', color: C.expense, fontFamily: 'Nunito_800ExtraBold', fontVariant: ['tabular-nums'] as any }}>
                -{fmtIDR(expenseSum)}
              </Text>
            )}
          </View>
        </View>

        {/* Transaction group card */}
        <View style={{ marginHorizontal: 16, backgroundColor: C.surface, borderRadius: 18, overflow: 'hidden', shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
          {item.data.map((txn, idx) => (
            <View key={txn.id}>
              <TransactionItem
                transaction={txn}
                showDate={false}
                memberName={selectedWsId ? (txn as any).memberName : undefined}
                onLongPress={() => handleDelete(txn)}
                onPress={() => setDetailTransaction(txn)}
              />
              {idx < item.data.length - 1 && (
                <View style={{ height: 1, backgroundColor: C.divider, marginLeft: 70 }} />
              )}
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
            <Text style={{ fontSize: 26, fontWeight: '900', color: C.fg1, letterSpacing: -0.5, fontFamily: 'Nunito_900Black' }}>Transaksi</Text>
            <Text style={{ fontSize: 13, fontWeight: '500', color: C.fg3, marginTop: 2, fontFamily: 'Nunito_500Medium' }}>
              {total > 0 ? `${total} transaksi` : 'Tidak ada transaksi'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {transactions.length > 0 && (
              <TouchableOpacity
                onPress={handleExportCSV}
                style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 16 }}>⬇</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setScanModalVisible(true)}
              style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#F4DDD0', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 16 }}>📷</Text>
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
              <Text style={{ fontSize: 16 }}>🔽</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Period chip */}
        <TouchableOpacity
          onPress={() => setShowPeriod(true)}
          style={{
            alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center',
            backgroundColor: C.primarySoft, borderRadius: 999,
            paddingHorizontal: 14, paddingVertical: 6, marginBottom: 12,
            borderWidth: 1.5, borderColor: C.primary,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: C.heroEnd, fontFamily: 'Nunito_700Bold' }}>
            📅 {range.label}
          </Text>
          <Text style={{ color: C.primary, marginLeft: 6, fontSize: 12 }}>▾</Text>
        </TouchableOpacity>

        {/* Search */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: C.surface, borderRadius: 14,
          paddingHorizontal: 14, paddingVertical: 12,
          borderWidth: 1, borderColor: C.border,
          gap: 10,
        }}>
          <Text style={{ fontSize: 16, color: C.fg3 }}>🔍</Text>
          <TextInput
            style={{ flex: 1, fontSize: 15, fontWeight: '600', color: C.fg1, fontFamily: 'Nunito_600SemiBold' }}
            placeholder="Cari transaksi..."
            placeholderTextColor={C.fg4}
            value={search}
            onChangeText={(v) => { setSearch(v); setPage(1) }}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setPage(1) }}>
              <Text style={{ color: C.fg4, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Workspace scope chips — only shown when user has workspaces */}
        {workspaces.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
            <TouchableOpacity
              onPress={() => setSelectedWsId(null)}
              style={{
                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
                backgroundColor: !selectedWsId ? C.primary : C.surface,
                borderWidth: 1.5, borderColor: !selectedWsId ? C.primary : C.border,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: !selectedWsId ? '#fff' : C.fg2, fontFamily: 'Nunito_700Bold' }}>Pribadi</Text>
            </TouchableOpacity>
            {workspaces.map((ws: any) => {
              const active = selectedWsId === ws.id
              return (
                <TouchableOpacity
                  key={ws.id}
                  onPress={() => setSelectedWsId(active ? null : ws.id)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
                    backgroundColor: active ? C.primary : C.surface,
                    borderWidth: 1.5, borderColor: active ? C.primary : C.border,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : C.fg2, fontFamily: 'Nunito_700Bold' }}>{ws.name}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        )}

        {/* Type filter chips */}
        {showFilters && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {TYPE_FILTERS.map((f) => {
              const active = typeFilter === f.value
              return (
                <TouchableOpacity
                  key={f.value}
                  onPress={() => { setTypeFilter(f.value); setPage(1) }}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999,
                    backgroundColor: active ? C.primary : C.surface,
                    borderWidth: 1.5, borderColor: active ? C.primary : C.border,
                  }}
                >
                  <Text style={{
                    fontSize: 13, fontWeight: '700', fontFamily: 'Nunito_700Bold',
                    color: active ? '#fff' : C.fg2,
                  }}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <LoadingSpinner />
        </View>
      ) : grouped.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🧾</Text>
          <Text style={{ fontSize: 17, fontWeight: '800', color: C.fg2, fontFamily: 'Nunito_800ExtraBold', textAlign: 'center' }}>
            {search ? `Tidak ditemukan "${search}"` : 'Belum ada transaksi'}
          </Text>
          <Text style={{ fontSize: 14, color: C.fg3, marginTop: 6, textAlign: 'center', fontFamily: 'Nunito_500Medium' }}>
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
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, fontFamily: 'Nunito_800ExtraBold' }}>Tambah Transaksi</Text>
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
            isFetching && !refreshing
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
