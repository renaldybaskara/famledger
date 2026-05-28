import { useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { Search, Plus, X, Filter, Trash2, Download } from 'lucide-react'
import { useTransactions, useDeleteTransaction } from '../../src/hooks/useTransactions'
import { Transaction, TransactionType } from '../../src/lib/api'
import { formatDateShort, getCurrentMonthRange } from '../../src/lib/format'
import { TransactionItem } from '../../components/transactions/TransactionItem'
import { AddTransactionModal } from '../../components/transactions/AddTransactionModal'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { EmptyState } from '../../components/ui/EmptyState'

type TypeFilter = '' | TransactionType

const TYPE_FILTERS: Array<{ value: TypeFilter; label: string }> = [
  { value: '', label: 'Semua' },
  { value: 'expense', label: 'Keluar' },
  { value: 'income', label: 'Masuk' },
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

export default function TransactionsScreen() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('')
  const [showFilters, setShowFilters] = useState(false)
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)

  const range = getCurrentMonthRange()

  const { data, isLoading, isFetching } = useTransactions({
    page,
    limit: 50,
    type: typeFilter || undefined,
    search: search.length >= 2 ? search : undefined,
    startDate: range.startDate,
    endDate: range.endDate,
  })

  const deleteMutation = useDeleteTransaction()

  const transactions = data?.data ?? []
  const total = data?.total ?? 0

  const grouped = useMemo(
    () => groupTransactionsByDate(transactions),
    [transactions]
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['transactions'] })
    setRefreshing(false)
  }, [queryClient])

  const handleExportCSV = () => {
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
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transaksi-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = (transaction: Transaction) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Hapus transaksi "${transaction.merchant || transaction.category?.name}"?`)) {
        deleteMutation.mutate(transaction.id)
      }
    } else {
      Alert.alert(
        'Hapus Transaksi',
        `Yakin ingin menghapus transaksi "${transaction.merchant || transaction.category?.name}"?`,
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Hapus',
            style: 'destructive',
            onPress: () => deleteMutation.mutate(transaction.id),
          },
        ]
      )
    }
  }

  const clearSearch = () => {
    setSearch('')
    setPage(1)
  }

  const handleTypeFilter = (t: TypeFilter) => {
    setTypeFilter(t)
    setPage(1)
  }

  // Render each group
  const renderGroup = ({ item }: { item: GroupedTransactions }) => {
    const incomeSum = item.data
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0)
    const expenseSum = item.data
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)

    return (
      <View className="mb-2">
        {/* Date header */}
        <View className="flex-row items-center justify-between px-4 py-2 bg-slate-50">
          <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wide">
            {formatDateShort(item.date)}
          </Text>
          <View className="flex-row gap-3">
            {incomeSum > 0 && (
              <Text className="text-income text-xs font-mono font-medium">
                +{Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(incomeSum)}
              </Text>
            )}
            {expenseSum > 0 && (
              <Text className="text-expense text-xs font-mono font-medium">
                -{Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(expenseSum)}
              </Text>
            )}
          </View>
        </View>

        {/* Transactions */}
        <View className="bg-white">
          {item.data.map((transaction, idx) => (
            <View key={transaction.id}>
              <TransactionItem
                transaction={transaction}
                showDate={false}
                onLongPress={() => handleDelete(transaction)}
                onPress={() => {
                  // Future: open edit modal
                }}
              />
              {idx < item.data.length - 1 && (
                <View className="h-px bg-slate-50 ml-16" />
              )}
            </View>
          ))}
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="bg-white px-4 pt-4 pb-3 border-b border-slate-100">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-xl font-bold text-slate-800">Transaksi</Text>
            <Text className="text-slate-400 text-xs mt-0.5">
              {total > 0 ? `${total} transaksi bulan ini` : 'Bulan ini'}
            </Text>
          </View>
          <View className="flex-row gap-2">
            {transactions.length > 0 && (
              <TouchableOpacity
                onPress={handleExportCSV}
                className="w-9 h-9 rounded-xl items-center justify-center bg-emerald-50"
              >
                <Download size={16} color="#10b981" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setShowFilters((v) => !v)}
              className={`w-9 h-9 rounded-xl items-center justify-center ${
                showFilters ? 'bg-primary' : 'bg-slate-100'
              }`}
            >
              <Filter size={16} color={showFilters ? 'white' : '#64748b'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
          <Search size={16} color="#94a3b8" />
          <TextInput
            className="flex-1 ml-2.5 text-slate-900 text-sm"
            placeholder="Cari merchant, catatan..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={(v) => {
              setSearch(v)
              setPage(1)
            }}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <X size={14} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Type filter */}
        {showFilters && (
          <View className="flex-row gap-2 mt-3 flex-wrap">
            {TYPE_FILTERS.map((f) => (
              <TouchableOpacity
                key={f.value}
                onPress={() => handleTypeFilter(f.value)}
                className={`px-4 py-1.5 rounded-full border ${
                  typeFilter === f.value
                    ? 'bg-primary border-primary'
                    : 'bg-white border-slate-200'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    typeFilter === f.value ? 'text-white' : 'text-slate-600'
                  }`}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* List */}
      {isLoading ? (
        <LoadingSpinner fullScreen message="Memuat transaksi..." />
      ) : grouped.length === 0 ? (
        <EmptyState
          title="Tidak ada transaksi"
          description={
            search
              ? `Tidak ditemukan transaksi untuk "${search}"`
              : 'Belum ada transaksi. Tambahkan transaksi pertamamu!'
          }
          action={
            <TouchableOpacity
              onPress={() => setAddModalVisible(true)}
              className="flex-row items-center bg-primary px-5 py-3 rounded-xl gap-2"
            >
              <Plus size={18} color="white" />
              <Text className="text-white font-semibold">Tambah Transaksi</Text>
            </TouchableOpacity>
          }
        />
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(item) => item.date}
          renderItem={renderGroup}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#1A2B4A"
              colors={['#1A2B4A']}
            />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            isFetching && !refreshing ? (
              <View className="py-4 items-center">
                <Text className="text-slate-400 text-xs">Memuat...</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={() => setAddModalVisible(true)}
        className="absolute bottom-6 right-5 w-14 h-14 bg-primary rounded-2xl items-center justify-center shadow-lg"
        style={{
          shadowColor: '#1A2B4A',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
        activeOpacity={0.85}
      >
        <Plus size={26} color="white" strokeWidth={2.5} />
      </TouchableOpacity>

      {/* Add transaction modal */}
      <AddTransactionModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
      />
    </SafeAreaView>
  )
}
