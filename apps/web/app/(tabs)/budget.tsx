import { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, X, Trash2, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { useBudgets, useCreateBudget, useDeleteBudget } from '../../src/hooks/useBudgets'
import { useCategories } from '../../src/hooks/useCategories'
import { Budget, Category } from '../../src/lib/api'
import { formatCurrency, formatCurrencyCompact, formatPercent } from '../../src/lib/format'
import { Card } from '../../components/ui/Card'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { EmptyState } from '../../components/ui/EmptyState'

// Form schema
const budgetSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  amount: z
    .string()
    .min(1, 'Jumlah wajib diisi')
    .refine(
      (v) => !isNaN(Number(v)) && Number(v) > 0,
      { message: 'Masukkan jumlah yang valid' }
    ),
  categoryId: z.string().optional(),
  period: z.enum(['monthly', 'weekly', 'yearly']),
})
type BudgetFormData = z.infer<typeof budgetSchema>

const PERIOD_OPTIONS = [
  { value: 'monthly', label: 'Bulanan' },
  { value: 'weekly', label: 'Mingguan' },
  { value: 'yearly', label: 'Tahunan' },
] as const

function getBudgetStatus(spent: number, total: number) {
  const pct = total > 0 ? (spent / total) * 100 : 0
  if (pct > 100) return { color: '#EF4444', bg: 'bg-red-500', label: 'Melebihi', icon: 'over' }
  if (pct >= 80) return { color: '#F59E0B', bg: 'bg-amber-400', label: 'Hampir habis', icon: 'warn' }
  return { color: '#10B981', bg: 'bg-emerald-500', label: 'Aman', icon: 'ok' }
}

interface BudgetCardProps {
  budget: Budget
  onDelete: () => void
}

function BudgetCard({ budget, onDelete }: BudgetCardProps) {
  const spent = budget.spent ?? 0
  const total = budget.amount
  const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0
  const overPct = total > 0 ? Math.max(((spent - total) / total) * 100, 0) : 0
  const status = getBudgetStatus(spent, total)
  const remaining = total - spent

  return (
    <Card padding="md" className="mb-3">
      {/* Header */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 mr-3">
          <Text className="text-slate-800 font-bold text-base">{budget.name}</Text>
          <View className="flex-row items-center mt-1 gap-2">
            {budget.category && (
              <View
                className="flex-row items-center px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${budget.category.color}20` }}
              >
                <Text style={{ fontSize: 12 }}>{budget.category.icon}</Text>
                <Text
                  className="text-xs font-medium ml-1"
                  style={{ color: budget.category.color }}
                >
                  {budget.category.name}
                </Text>
              </View>
            )}
            <View className="bg-slate-100 px-2 py-0.5 rounded-full">
              <Text className="text-slate-500 text-xs">
                {PERIOD_OPTIONS.find((p) => p.value === budget.period)?.label ?? 'Bulanan'}
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          {/* Status badge */}
          <View
            className="flex-row items-center px-2 py-1 rounded-lg gap-1"
            style={{
              backgroundColor:
                status.icon === 'over'
                  ? '#FEE2E2'
                  : status.icon === 'warn'
                  ? '#FEF3C7'
                  : '#D1FAE5',
            }}
          >
            {status.icon === 'over' ? (
              <AlertTriangle size={12} color={status.color} />
            ) : status.icon === 'warn' ? (
              <AlertTriangle size={12} color={status.color} />
            ) : (
              <CheckCircle size={12} color={status.color} />
            )}
            <Text className="text-xs font-medium" style={{ color: status.color }}>
              {status.label}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onDelete}
            className="w-8 h-8 bg-slate-100 rounded-lg items-center justify-center"
          >
            <Trash2 size={14} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress bar */}
      <View className="mb-3">
        <View className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <View
            className={`h-full rounded-full ${status.bg}`}
            style={{ width: `${pct}%` }}
          />
        </View>
        {spent > total && (
          <Text className="text-red-500 text-xs mt-1">
            Melebihi {formatPercent(overPct)} dari anggaran
          </Text>
        )}
      </View>

      {/* Amount details */}
      <View className="flex-row justify-between items-center">
        <View>
          <Text className="text-slate-400 text-xs">Terpakai</Text>
          <Text className="text-slate-800 font-bold font-mono text-sm">
            {formatCurrencyCompact(spent)}
          </Text>
        </View>
        <View className="items-center">
          <Text className="text-slate-400 text-xs">Progress</Text>
          <Text
            className="font-bold text-sm font-mono"
            style={{ color: status.color }}
          >
            {formatPercent((spent / total) * 100)}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-slate-400 text-xs">
            {remaining >= 0 ? 'Sisa' : 'Lebih'}
          </Text>
          <Text
            className={`font-bold font-mono text-sm ${
              remaining >= 0 ? 'text-slate-800' : 'text-red-500'
            }`}
          >
            {formatCurrencyCompact(Math.abs(remaining))}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-slate-400 text-xs">Anggaran</Text>
          <Text className="text-slate-600 font-mono text-sm">
            {formatCurrencyCompact(total)}
          </Text>
        </View>
      </View>
    </Card>
  )
}

function AddBudgetModal({
  visible,
  onClose,
}: {
  visible: boolean
  onClose: () => void
}) {
  const { data: categories = [] } = useCategories()
  const createMutation = useCreateBudget()
  const [serverError, setServerError] = useState('')

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      name: '',
      amount: '',
      categoryId: '',
      period: 'monthly',
    },
  })

  const handleClose = () => {
    reset()
    setServerError('')
    onClose()
  }

  const onSubmit = (data: BudgetFormData) => {
    setServerError('')
    const now = new Date()
    createMutation.mutate(
      {
        name: data.name,
        amount: parseFloat(data.amount),
        categoryId: data.categoryId || undefined,
        period: data.period,
        startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
      },
      {
        onSuccess: handleClose,
        onError: (err: any) => {
          setServerError(err.response?.data?.message || 'Gagal membuat anggaran')
        },
      }
    )
  }

  const expenseCategories = categories.filter((c: Category) => c.type === 'expense')

  const content = (
    <View className="bg-white rounded-t-3xl flex-1">
      <View className="items-center pt-3 pb-1">
        <View className="w-10 h-1 bg-slate-200 rounded-full" />
      </View>

      <View className="flex-row items-center justify-between px-5 py-3 border-b border-slate-100">
        <Text className="text-lg font-bold text-slate-800">Tambah Anggaran</Text>
        <TouchableOpacity
          onPress={handleClose}
          className="w-8 h-8 bg-slate-100 rounded-full items-center justify-center"
        >
          <X size={16} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <View className="py-4 gap-4">
          {serverError ? (
            <View className="bg-red-50 border border-red-200 rounded-xl p-3">
              <Text className="text-red-600 text-sm text-center">{serverError}</Text>
            </View>
          ) : null}

          {/* Name */}
          <View>
            <Text className="text-slate-600 text-sm font-medium mb-2">Nama Anggaran</Text>
            <Controller
              control={control}
              name="name"
              render={({ field: { value, onChange } }) => (
                <TextInput
                  className={`bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 ${
                    errors.name ? 'border-red-400' : 'border-slate-200'
                  }`}
                  placeholder="Contoh: Makan & Minum"
                  placeholderTextColor="#94a3b8"
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
            {errors.name && (
              <Text className="text-red-500 text-xs mt-1">{errors.name.message}</Text>
            )}
          </View>

          {/* Amount */}
          <View>
            <Text className="text-slate-600 text-sm font-medium mb-2">Batas Anggaran (Rp)</Text>
            <Controller
              control={control}
              name="amount"
              render={({ field: { value, onChange } }) => (
                <TextInput
                  className={`bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 text-lg font-mono ${
                    errors.amount ? 'border-red-400' : 'border-slate-200'
                  }`}
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
            {errors.amount && (
              <Text className="text-red-500 text-xs mt-1">{errors.amount.message}</Text>
            )}
          </View>

          {/* Period */}
          <View>
            <Text className="text-slate-600 text-sm font-medium mb-2">Periode</Text>
            <Controller
              control={control}
              name="period"
              render={({ field: { value, onChange } }) => (
                <View className="flex-row gap-2">
                  {PERIOD_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => onChange(opt.value)}
                      className={`flex-1 py-2.5 rounded-xl items-center border-2 ${
                        value === opt.value
                          ? 'bg-primary border-primary'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          value === opt.value ? 'text-white' : 'text-slate-500'
                        }`}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />
          </View>

          {/* Category (optional) */}
          <View>
            <Text className="text-slate-600 text-sm font-medium mb-2">
              Kategori <Text className="text-slate-400 font-normal">(opsional)</Text>
            </Text>
            <Controller
              control={control}
              name="categoryId"
              render={({ field: { value, onChange } }) => (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => onChange('')}
                      className={`px-3 py-2 rounded-xl border-2 ${
                        !value
                          ? 'bg-primary border-primary'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          !value ? 'text-white' : 'text-slate-600'
                        }`}
                      >
                        Semua
                      </Text>
                    </TouchableOpacity>
                    {expenseCategories.map((cat: Category) => (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => onChange(cat.id)}
                        className={`flex-row items-center px-3 py-2 rounded-xl border-2 ${
                          value === cat.id
                            ? 'border-transparent'
                            : 'border-slate-200 bg-slate-50'
                        }`}
                        style={
                          value === cat.id
                            ? { backgroundColor: cat.color, borderColor: cat.color }
                            : {}
                        }
                      >
                        <Text style={{ fontSize: 14 }}>{cat.icon}</Text>
                        <Text
                          className={`ml-1.5 text-sm font-medium ${
                            value === cat.id ? 'text-white' : 'text-slate-600'
                          }`}
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit(onSubmit)}
            disabled={createMutation.isPending}
            className={`rounded-xl py-4 items-center ${
              createMutation.isPending ? 'bg-primary/60' : 'bg-primary'
            }`}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text className="text-white font-semibold text-base">Simpan Anggaran</Text>
            )}
          </TouchableOpacity>
          <View className="h-8" />
        </View>
      </ScrollView>
    </View>
  )

  if (Platform.OS === 'web') {
    if (!visible) return null
    return (
      <View
        style={{
          position: 'fixed' as any,
          inset: 0,
          zIndex: 1000,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
          display: 'flex',
        }}
      >
        <TouchableOpacity
          style={{ position: 'absolute' as any, inset: 0 }}
          onPress={handleClose}
          activeOpacity={1}
        />
        <View
          style={{
            backgroundColor: 'white',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '85vh' as any,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {content}
        </View>
      </View>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View className="flex-1 justify-end bg-black/50">
        <TouchableOpacity className="absolute inset-0" onPress={handleClose} activeOpacity={1} />
        <View style={{ maxHeight: '85%' }}>{content}</View>
      </View>
    </Modal>
  )
}

export default function BudgetScreen() {
  const queryClient = useQueryClient()
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const { data: budgets = [], isLoading } = useBudgets()
  const deleteMutation = useDeleteBudget()

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['budgets'] })
    setRefreshing(false)
  }, [queryClient])

  const handleDelete = (budget: Budget) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Hapus anggaran "${budget.name}"?`)) {
        deleteMutation.mutate(budget.id)
      }
    } else {
      Alert.alert('Hapus Anggaran', `Yakin ingin menghapus anggaran "${budget.name}"?`, [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(budget.id),
        },
      ])
    }
  }

  // Summary stats
  const totalBudget = budgets.reduce((s: number, b: Budget) => s + b.amount, 0)
  const totalSpent = budgets.reduce((s: number, b: Budget) => s + (b.spent ?? 0), 0)
  const overBudgetCount = budgets.filter(
    (b: Budget) => (b.spent ?? 0) > b.amount
  ).length

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="bg-white px-4 pt-4 pb-4 border-b border-slate-100">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xl font-bold text-slate-800">Anggaran</Text>
            <Text className="text-slate-400 text-xs mt-0.5">
              {budgets.length} anggaran aktif
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setAddModalVisible(true)}
            className="flex-row items-center bg-primary px-3 py-2 rounded-xl gap-1.5"
          >
            <Plus size={16} color="white" />
            <Text className="text-white font-semibold text-sm">Tambah</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
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
        <View className="pt-4 gap-3">
          {/* Summary overview */}
          {budgets.length > 0 && (
            <Card padding="md" className="mb-1">
              <Text className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-3">
                Ringkasan Anggaran
              </Text>
              <View className="flex-row justify-between">
                <View>
                  <Text className="text-slate-400 text-xs">Total Anggaran</Text>
                  <Text className="text-primary font-bold font-mono text-base">
                    {formatCurrencyCompact(totalBudget)}
                  </Text>
                </View>
                <View className="items-center">
                  <Text className="text-slate-400 text-xs">Terpakai</Text>
                  <Text className="text-slate-800 font-bold font-mono text-base">
                    {formatCurrencyCompact(totalSpent)}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-slate-400 text-xs">Melebihi</Text>
                  <Text
                    className={`font-bold text-base ${
                      overBudgetCount > 0 ? 'text-red-500' : 'text-emerald-500'
                    }`}
                  >
                    {overBudgetCount} kategori
                  </Text>
                </View>
              </View>

              {/* Overall progress */}
              <View className="mt-3">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-slate-400 text-xs">Total progress</Text>
                  <Text className="text-slate-600 text-xs font-mono">
                    {totalBudget > 0
                      ? formatPercent((totalSpent / totalBudget) * 100)
                      : '0%'}
                  </Text>
                </View>
                <View className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <View
                    className={`h-full rounded-full ${
                      totalSpent > totalBudget
                        ? 'bg-red-500'
                        : totalSpent / totalBudget >= 0.8
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${
                        totalBudget > 0
                          ? Math.min((totalSpent / totalBudget) * 100, 100)
                          : 0
                      }%`,
                    }}
                  />
                </View>
              </View>
            </Card>
          )}

          {isLoading ? (
            <LoadingSpinner fullScreen message="Memuat anggaran..." />
          ) : budgets.length === 0 ? (
            <EmptyState
              title="Belum ada anggaran"
              description="Buat anggaran untuk mengontrol pengeluaranmu setiap bulan."
              action={
                <TouchableOpacity
                  onPress={() => setAddModalVisible(true)}
                  className="flex-row items-center bg-primary px-5 py-3 rounded-xl gap-2"
                >
                  <Plus size={18} color="white" />
                  <Text className="text-white font-semibold">Tambah Anggaran</Text>
                </TouchableOpacity>
              }
            />
          ) : (
            budgets.map((budget: Budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                onDelete={() => handleDelete(budget)}
              />
            ))
          )}

          <View className="h-6" />
        </View>
      </ScrollView>

      <AddBudgetModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
      />
    </SafeAreaView>
  )
}
