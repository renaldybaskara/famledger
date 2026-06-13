import { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, Modal, TextInput, ActivityIndicator,
  Alert, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { useBudgets, useCreateBudget, useDeleteBudget } from '../../src/hooks/useBudgets'
import { useCategories } from '../../src/hooks/useCategories'
import { Budget, Category } from '../../src/lib/api'
import { formatCurrencyCompact, formatPercent } from '../../src/lib/format'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'

// ── Saku tokens ───────────────────────────────────────────────
const C = {
  cream:        '#FAF7F2',
  creamSunken:  '#F4EEE3',
  surface:      '#FFFFFF',
  primary:      '#6B8E6B',
  primarySoft:  '#DEE8D7',
  heroStart:    '#6B8E6B',
  heroEnd:      '#41594F',
  accent:       '#C97B5C',
  mustard:      '#D9A441',
  mustardSoft:  '#FBEFD2',
  danger:       '#C66B6B',
  dangerSoft:   '#F5D9D9',
  fg1:          '#2D2A26',
  fg2:          '#55504A',
  fg3:          '#8E887F',
  fg4:          '#A8A39B',
  border:       '#E0DBD2',
  divider:      '#ECE4D3',
}

// ── Budget form ───────────────────────────────────────────────
const budgetSchema = z.object({
  name:       z.string().min(2, 'Nama minimal 2 karakter'),
  amount:     z.string().min(1, 'Jumlah wajib diisi')
                .refine((v) => !isNaN(Number(v)) && Number(v) > 0, { message: 'Masukkan jumlah valid' }),
  categoryId: z.string().optional(),
  period:     z.enum(['monthly', 'weekly', 'yearly']),
})
type BudgetFormData = z.infer<typeof budgetSchema>

const PERIOD_OPTIONS = [
  { value: 'monthly', label: 'Bulanan' },
  { value: 'weekly',  label: 'Mingguan' },
  { value: 'yearly',  label: 'Tahunan'  },
] as const

function getBudgetStatus(spent: number, total: number) {
  const pct = total > 0 ? (spent / total) * 100 : 0
  if (pct > 100) return { color: C.danger,   barColor: C.danger,   bg: C.dangerSoft,  label: 'Melebihi' }
  if (pct >= 80) return { color: C.mustard,  barColor: C.mustard,  bg: C.mustardSoft, label: 'Hampir habis' }
  return              { color: C.primary,   barColor: C.primary,  bg: C.primarySoft, label: 'Aman' }
}

// ── Budget card ───────────────────────────────────────────────
function BudgetCard({ budget, onDelete }: { budget: Budget; onDelete: () => void }) {
  const spent     = budget.spent ?? 0
  const total     = budget.amount
  const pct       = total > 0 ? Math.min((spent / total) * 100, 100) : 0
  const remaining = total - spent
  const status    = getBudgetStatus(spent, total)

  return (
    <View style={{
      backgroundColor: C.surface, borderRadius: 18, padding: 16, marginBottom: 12,
      shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: C.fg1, fontFamily: 'Nunito_800ExtraBold' }}>{budget.name}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {budget.category && (
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
                backgroundColor: (budget.category.color ?? C.primary) + '22',
              }}>
                <Text style={{ fontSize: 11 }}>{budget.category.icon}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: budget.category.color ?? C.primary, marginLeft: 4, fontFamily: 'Nunito_700Bold' }}>
                  {budget.category.name}
                </Text>
              </View>
            )}
            <View style={{ backgroundColor: C.creamSunken, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: C.fg3, fontFamily: 'Nunito_600SemiBold' }}>
                {PERIOD_OPTIONS.find((p) => p.value === budget.period)?.label ?? 'Bulanan'}
              </Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: status.bg }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: status.color, fontFamily: 'Nunito_700Bold' }}>{status.label}</Text>
          </View>
          <TouchableOpacity
            onPress={onDelete}
            style={{ width: 32, height: 32, backgroundColor: C.creamSunken, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 14, color: C.danger }}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress bar */}
      <View style={{ marginBottom: 12 }}>
        <View style={{ height: 8, backgroundColor: C.creamSunken, borderRadius: 999, overflow: 'hidden' }}>
          <View style={{ width: `${pct}%` as any, height: '100%', backgroundColor: status.barColor, borderRadius: 999 }} />
        </View>
        {spent > total && (
          <Text style={{ fontSize: 12, color: C.danger, marginTop: 4, fontWeight: '600', fontFamily: 'Nunito_600SemiBold' }}>
            Melebihi {formatPercent(((spent - total) / total) * 100)} dari anggaran
          </Text>
        )}
      </View>

      {/* Stats row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {[
          { label: 'Terpakai',  value: formatCurrencyCompact(spent),         color: C.fg1 },
          { label: 'Progress',  value: formatPercent((spent / total) * 100),  color: status.color },
          { label: remaining >= 0 ? 'Sisa' : 'Lebih', value: formatCurrencyCompact(Math.abs(remaining)), color: remaining >= 0 ? C.fg1 : C.danger },
          { label: 'Anggaran',  value: formatCurrencyCompact(total),          color: C.fg3 },
        ].map(({ label, value, color }) => (
          <View key={label}>
            <Text style={{ fontSize: 11, color: C.fg4, fontFamily: 'Nunito_500Medium' }}>{label}</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color, fontFamily: 'Nunito_800ExtraBold', fontVariant: ['tabular-nums'] as any }}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// ── Add Budget Modal ──────────────────────────────────────────
function AddBudgetModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data: categories = [] } = useCategories()
  const createMutation            = useCreateBudget()
  const [serverError, setServerError] = useState('')

  const { control, handleSubmit, reset, formState: { errors } } = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { name: '', amount: '', categoryId: '', period: 'monthly' },
  })

  const handleClose = () => { reset(); setServerError(''); onClose() }

  const onSubmit = (data: BudgetFormData) => {
    setServerError('')
    const now = new Date()
    createMutation.mutate(
      { name: data.name, amount: parseFloat(data.amount), categoryId: data.categoryId || undefined, period: data.period, startDate: format(startOfMonth(now), 'yyyy-MM-dd'), endDate: format(endOfMonth(now), 'yyyy-MM-dd') },
      { onSuccess: handleClose, onError: (err: any) => setServerError(err.response?.data?.message || 'Gagal membuat anggaran') }
    )
  }

  const expenseCats = (categories as Category[]).filter((c) => c.type === 'expense')

  const content = (
    <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32 }}>
      {/* Handle */}
      <View style={{ alignItems: 'center', paddingTop: 12 }}>
        <View style={{ width: 36, height: 4, borderRadius: 999, backgroundColor: C.border }} />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: C.divider }}>
        <Text style={{ fontSize: 18, fontWeight: '900', color: C.fg1, fontFamily: 'Nunito_900Black' }}>Tambah Anggaran</Text>
        <TouchableOpacity onPress={handleClose} style={{ width: 32, height: 32, backgroundColor: C.creamSunken, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18, color: C.fg2 }}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
        <View style={{ padding: 20, gap: 16 }}>
          {serverError ? (
            <View style={{ backgroundColor: C.dangerSoft, borderRadius: 12, padding: 12 }}>
              <Text style={{ color: C.danger, fontSize: 13, textAlign: 'center', fontFamily: 'Nunito_600SemiBold' }}>{serverError}</Text>
            </View>
          ) : null}

          {/* Name */}
          <View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.fg2, marginBottom: 8, fontFamily: 'Nunito_700Bold' }}>Nama Anggaran</Text>
            <Controller
              control={control} name="name"
              render={({ field: { value, onChange } }) => (
                <TextInput
                  style={{ backgroundColor: C.creamSunken, borderWidth: 1.5, borderColor: errors.name ? C.danger : C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: C.fg1, fontFamily: 'Nunito_600SemiBold' }}
                  placeholder="Contoh: Makan & Minum"
                  placeholderTextColor={C.fg4}
                  value={value} onChangeText={onChange}
                />
              )}
            />
            {errors.name && <Text style={{ color: C.danger, fontSize: 12, marginTop: 4 }}>{errors.name.message}</Text>}
          </View>

          {/* Amount */}
          <View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.fg2, marginBottom: 8, fontFamily: 'Nunito_700Bold' }}>Batas Anggaran (Rp)</Text>
            <Controller
              control={control} name="amount"
              render={({ field: { value, onChange } }) => (
                <TextInput
                  style={{ backgroundColor: C.creamSunken, borderWidth: 1.5, borderColor: errors.amount ? C.danger : C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 22, fontWeight: '900', color: C.fg1, fontFamily: 'Nunito_900Black', fontVariant: ['tabular-nums'] as any }}
                  placeholder="0"
                  placeholderTextColor={C.fg4}
                  keyboardType="numeric"
                  value={value} onChangeText={onChange}
                />
              )}
            />
            {errors.amount && <Text style={{ color: C.danger, fontSize: 12, marginTop: 4 }}>{errors.amount.message}</Text>}
          </View>

          {/* Period */}
          <View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.fg2, marginBottom: 8, fontFamily: 'Nunito_700Bold' }}>Periode</Text>
            <Controller
              control={control} name="period"
              render={({ field: { value, onChange } }) => (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {PERIOD_OPTIONS.map((opt) => {
                    const active = value === opt.value
                    return (
                      <TouchableOpacity
                        key={opt.value} onPress={() => onChange(opt.value)}
                        style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 2, backgroundColor: active ? C.primary : C.creamSunken, borderColor: active ? C.primary : C.border }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : C.fg2, fontFamily: 'Nunito_700Bold' }}>{opt.label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )}
            />
          </View>

          {/* Category */}
          <View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.fg2, marginBottom: 8, fontFamily: 'Nunito_700Bold' }}>
              Kategori <Text style={{ fontWeight: '500', color: C.fg3 }}>(opsional)</Text>
            </Text>
            <Controller
              control={control} name="categoryId"
              render={({ field: { value, onChange } }) => (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => onChange('')}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 2, backgroundColor: !value ? C.primary : C.creamSunken, borderColor: !value ? C.primary : C.border }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: !value ? '#fff' : C.fg2, fontFamily: 'Nunito_700Bold' }}>Semua</Text>
                    </TouchableOpacity>
                    {expenseCats.map((cat) => {
                      const active = value === cat.id
                      return (
                        <TouchableOpacity
                          key={cat.id} onPress={() => onChange(cat.id)}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 2, backgroundColor: active ? cat.color : C.creamSunken, borderColor: active ? cat.color : C.border }}
                        >
                          <Text style={{ fontSize: 14 }}>{cat.icon}</Text>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : C.fg2, marginLeft: 6, fontFamily: 'Nunito_700Bold' }}>{cat.name}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </ScrollView>
              )}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit(onSubmit)}
            disabled={createMutation.isPending}
            style={{ backgroundColor: createMutation.isPending ? C.primary + '99' : C.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 4 }}
          >
            {createMutation.isPending
              ? <ActivityIndicator color="white" size="small" />
              : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, fontFamily: 'Nunito_900Black' }}>Simpan Anggaran</Text>}
          </TouchableOpacity>
          <View style={{ height: 16 }} />
        </View>
      </ScrollView>
    </View>
  )

  if (Platform.OS === 'web') {
    if (!visible) return null
    return (
      <View style={{ position: 'fixed' as any, inset: 0, zIndex: 100, backgroundColor: 'rgba(45,42,38,0.45)', justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ position: 'absolute' as any, inset: 0 }} onPress={handleClose} activeOpacity={1} />
        <View style={{ maxHeight: '90%' }}>{content}</View>
      </View>
    )
  }
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(45,42,38,0.45)' }}>
        <TouchableOpacity style={{ position: 'absolute', inset: 0 } as any} onPress={handleClose} activeOpacity={1} />
        <View style={{ maxHeight: '90%' }}>{content}</View>
      </View>
    </Modal>
  )
}

// ── Budget Screen ─────────────────────────────────────────────
export default function BudgetScreen() {
  const queryClient               = useQueryClient()
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
    Alert.alert('Hapus Anggaran', `Hapus "${budget.name}"?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => deleteMutation.mutate(budget.id) },
    ])
  }

  const totalBudget   = (budgets as Budget[]).reduce((s, b) => s + b.amount, 0)
  const totalSpent    = (budgets as Budget[]).reduce((s, b) => s + (b.spent ?? 0), 0)
  const overCount     = (budgets as Budget[]).filter((b) => (b.spent ?? 0) > b.amount).length
  const overallPct    = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0
  const overallStatus = totalSpent > totalBudget ? C.danger : totalSpent / totalBudget >= 0.8 ? C.mustard : C.primary

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 26, fontWeight: '900', color: C.fg1, letterSpacing: -0.5, fontFamily: 'Nunito_900Black' }}>Anggaran</Text>
            <Text style={{ fontSize: 13, color: C.fg3, marginTop: 2, fontFamily: 'Nunito_500Medium' }}>
              {(budgets as Budget[]).length} anggaran aktif
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setAddModalVisible(true)}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, gap: 6 }}
          >
            <Text style={{ color: '#fff', fontSize: 18, lineHeight: 20 }}>+</Text>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14, fontFamily: 'Nunito_800ExtraBold' }}>Tambah</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />}
      >
        <View style={{ paddingTop: 4, paddingBottom: 100 }}>

          {/* Summary card — sage→mustard gradient */}
          {(budgets as Budget[]).length > 0 && (
            <View style={{
              borderRadius: 20, padding: 18, marginBottom: 16, overflow: 'hidden',
              backgroundColor: C.heroStart,
              ...({ background: `linear-gradient(135deg, ${C.heroStart} 0%, ${C.mustard} 100%)` } as any),
            }}>
              {/* Blob */}
              <View style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' }} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, fontFamily: 'Nunito_800ExtraBold' }}>
                Ringkasan Anggaran
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
                {[
                  { label: 'Total', value: formatCurrencyCompact(totalBudget) },
                  { label: 'Terpakai', value: formatCurrencyCompact(totalSpent) },
                  { label: 'Melebihi', value: `${overCount} kategori`, highlight: overCount > 0 },
                ].map(({ label, value, highlight }) => (
                  <View key={label}>
                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontFamily: 'Nunito_500Medium' }}>{label}</Text>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: highlight ? '#FFD4D4' : '#fff', fontFamily: 'Nunito_900Black', fontVariant: ['tabular-nums'] as any }}>
                      {value}
                    </Text>
                  </View>
                ))}
              </View>
              {/* Overall progress */}
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontFamily: 'Nunito_600SemiBold' }}>Total progress</Text>
                  <Text style={{ fontSize: 12, color: '#fff', fontFamily: 'Nunito_700Bold', fontVariant: ['tabular-nums'] as any }}>
                    {formatPercent(overallPct)}
                  </Text>
                </View>
                <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 999, overflow: 'hidden' }}>
                  <View style={{ width: `${overallPct}%` as any, height: '100%', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 999 }} />
                </View>
              </View>
            </View>
          )}

          {isLoading ? (
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <LoadingSpinner />
            </View>
          ) : (budgets as Budget[]).length === 0 ? (
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <Text style={{ fontSize: 52, marginBottom: 16 }}>🎯</Text>
              <Text style={{ fontSize: 18, fontWeight: '900', color: C.fg2, fontFamily: 'Nunito_900Black' }}>Belum ada anggaran</Text>
              <Text style={{ fontSize: 14, color: C.fg3, marginTop: 6, textAlign: 'center', fontFamily: 'Nunito_500Medium', lineHeight: 20 }}>
                Buat anggaran untuk kontrol{'\n'}pengeluaran bulan ini.
              </Text>
              <TouchableOpacity
                onPress={() => setAddModalVisible(true)}
                style={{ marginTop: 20, backgroundColor: C.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Text style={{ color: '#fff', fontSize: 18 }}>+</Text>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, fontFamily: 'Nunito_800ExtraBold' }}>Tambah Anggaran</Text>
              </TouchableOpacity>
            </View>
          ) : (
            (budgets as Budget[]).map((budget) => (
              <BudgetCard key={budget.id} budget={budget} onDelete={() => handleDelete(budget)} />
            ))
          )}
        </View>
      </ScrollView>

      <AddBudgetModal visible={addModalVisible} onClose={() => setAddModalVisible(false)} />
    </SafeAreaView>
  )
}
