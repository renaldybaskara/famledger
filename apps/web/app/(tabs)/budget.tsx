import React, { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, Modal, TextInput, ActivityIndicator,
  Alert, Platform,
} from 'react-native'
import { Trash2, Pencil } from 'lucide-react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { id } from 'date-fns/locale'
import { useBudgets, useCreateBudget, useDeleteBudget, useUpdateBudget } from '../../src/hooks/useBudgets'
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
  if (pct > 100) return { color: C.danger,  barColor: C.danger,  bg: C.dangerSoft,  label: 'Melebihi',    cardBg: '#FFF5F5', cardBorder: '#FFDDDD', iconBg: '#FFE8E8' }
  if (pct >= 80) return { color: C.mustard, barColor: C.mustard, bg: C.mustardSoft, label: 'Hampir habis', cardBg: '#FFF8F5', cardBorder: '#FAEAE3', iconBg: '#FDF2EE' }
  return              { color: C.primary,  barColor: C.primary, bg: C.primarySoft, label: 'Aman',         cardBg: '#F7FAFA', cardBorder: 'transparent', iconBg: '' }
}

// ── Budget card ───────────────────────────────────────────────
function BudgetCard({ budget, onDelete, onEdit }: { budget: Budget; onDelete: () => void; onEdit: () => void }) {
  const spent     = budget.spent ?? 0
  const total     = budget.amount
  const rawPct    = total > 0 ? (spent / total) * 100 : 0
  const pct       = Math.min(rawPct, 100)
  const remaining = total - spent
  const status    = getBudgetStatus(spent, total)
  const catColor  = budget.category?.color ?? C.primary
  const catIcon   = budget.category?.icon ?? '💰'

  return (
    <View style={{
      backgroundColor: status.cardBg, borderRadius: 20, padding: 16, marginBottom: 12,
      borderWidth: status.cardBorder !== 'transparent' ? 1 : 0, borderColor: status.cardBorder,
      shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    }}>
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        {/* Category icon */}
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: status.iconBg || catColor + '22', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Text style={{ fontSize: 22 }}>{catIcon}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: C.fg1, fontFamily: 'Nunito_800ExtraBold' }}>{budget.name}</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: status.color, fontFamily: 'Nunito_700Bold', fontVariant: ['tabular-nums'] as any }}>
              {Math.round(rawPct)}%
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: C.fg3, marginTop: 2, fontFamily: 'Nunito_500Medium', fontVariant: ['tabular-nums'] as any }}>
            {formatCurrencyCompact(spent)} dari {formatCurrencyCompact(total)}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onEdit}
          style={{ width: 30, height: 30, backgroundColor: C.primarySoft, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}
        >
          <Pencil size={13} color={C.primary} strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onDelete}
          style={{ width: 30, height: 30, backgroundColor: C.creamSunken, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}
        >
          <Trash2 size={13} color={C.danger} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={{ height: 8, backgroundColor: C.creamSunken, borderRadius: 999, overflow: 'hidden', marginBottom: 10 }}>
        <View style={{ width: `${pct}%` as any, height: '100%', backgroundColor: status.barColor, borderRadius: 999 }} />
      </View>

      {/* Status footer */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {rawPct > 100 ? (
          <Text style={{ fontSize: 12, color: C.danger, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>
            ● Over budget {formatCurrencyCompact(spent - total)}
          </Text>
        ) : rawPct >= 80 ? (
          <Text style={{ fontSize: 12, color: C.mustard, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>
            ⚠ Hampir habis
          </Text>
        ) : (
          <Text style={{ fontSize: 12, color: C.fg4, fontFamily: 'Nunito_500Medium' }}>
            {PERIOD_OPTIONS.find((p) => p.value === budget.period)?.label ?? 'Bulanan'}
          </Text>
        )}
        <Text style={{ fontSize: 12, color: remaining >= 0 ? C.fg2 : C.danger, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', fontVariant: ['tabular-nums'] as any }}>
          {remaining >= 0 ? `Sisa ${formatCurrencyCompact(remaining)}` : `Lebih ${formatCurrencyCompact(-remaining)}`}
        </Text>
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

// ── Edit Budget Modal ─────────────────────────────────────────
function EditBudgetModal({ visible, budget, onClose }: { visible: boolean; budget: Budget | null; onClose: () => void }) {
  const { data: categories = [] } = useCategories()
  const updateMutation            = useUpdateBudget()
  const [serverError, setServerError] = useState('')

  const { control, handleSubmit, reset, formState: { errors } } = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { name: '', amount: '', categoryId: '', period: 'monthly' },
  })

  // Sync form whenever the target budget changes
  React.useEffect(() => {
    if (budget) {
      reset({
        name:       budget.name,
        amount:     String(budget.amount),
        categoryId: budget.category?.id ?? '',
        period:     (budget.period as BudgetFormData['period']) ?? 'monthly',
      })
    }
  }, [budget, reset])

  const handleClose = () => { reset(); setServerError(''); onClose() }

  const onSubmit = (data: BudgetFormData) => {
    if (!budget) return
    setServerError('')
    updateMutation.mutate(
      { id: budget.id, data: { name: data.name, amount: parseFloat(data.amount), categoryId: data.categoryId || undefined, period: data.period } },
      { onSuccess: handleClose, onError: (err: any) => setServerError(err.response?.data?.message || 'Gagal mengubah anggaran') }
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
        <Text style={{ fontSize: 18, fontWeight: '900', color: C.fg1, fontFamily: 'Nunito_900Black' }}>Edit Anggaran</Text>
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
            disabled={updateMutation.isPending}
            style={{ backgroundColor: updateMutation.isPending ? C.primary + '99' : C.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 4 }}
          >
            {updateMutation.isPending
              ? <ActivityIndicator color="white" size="small" />
              : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, fontFamily: 'Nunito_900Black' }}>Simpan Perubahan</Text>}
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
function DonutSVG({ pct }: { pct: number }) {
  const size = 90
  const sw = 10
  const r = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const capped = Math.min(pct, 100)
  const dash = (capped / 100) * circ
  const color = pct > 100 ? '#FFB3B3' : pct >= 80 ? '#D9A441' : 'rgba(255,255,255,0.9)'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' } as any}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={sw}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 - 5} textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={16} fontWeight="900" fontFamily="Nunito, sans-serif">
        {Math.round(pct)}%
      </text>
      <text x={size / 2} y={size / 2 + 12} textAnchor="middle" dominantBaseline="middle"
        fill="rgba(255,255,255,0.6)" fontSize={9} fontFamily="Nunito, sans-serif">
        terpakai
      </text>
    </svg>
  )
}

export default function BudgetScreen() {
  const queryClient               = useQueryClient()
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [editBudget, setEditBudget] = useState<Budget | null>(null)
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
      return
    }
    Alert.alert('Hapus Anggaran', `Hapus "${budget.name}"?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => deleteMutation.mutate(budget.id) },
    ])
  }

  const totalBudget   = (budgets as Budget[]).reduce((s, b) => s + b.amount, 0)
  const totalSpent    = (budgets as Budget[]).reduce((s, b) => s + (b.spent ?? 0), 0)
  const overCount     = (budgets as Budget[]).filter((b) => (b.spent ?? 0) > b.amount).length
  const overallPct    = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0
  const remaining     = totalBudget - totalSpent
  const today         = new Date()
  const lastDay       = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const daysLeft      = lastDay - today.getDate()
  const dailyRate     = daysLeft > 0 && remaining > 0 ? remaining / daysLeft : 0
  const currentMonth  = format(today, 'MMMM', { locale: id })

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 26, fontWeight: '900', color: C.fg1, letterSpacing: -0.5, fontFamily: 'Nunito_900Black' }}>Budget</Text>
          <TouchableOpacity
            onPress={() => setAddModalVisible(true)}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, gap: 4 }}
          >
            <Text style={{ color: '#fff', fontSize: 16, lineHeight: 18 }}>+</Text>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13, fontFamily: 'Nunito_800ExtraBold' }}>Buat Budget</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />}
      >
        <View style={{ paddingTop: 4, paddingBottom: 100 }}>

          {/* Overview card */}
          {(budgets as Budget[]).length > 0 && (
            <View style={{ borderRadius: 24, padding: 20, marginBottom: 16, overflow: 'hidden', backgroundColor: C.heroEnd }}>
              <View style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)' }} />
              <View style={{ position: 'absolute', bottom: -20, left: -30, width: 100, height: 100, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)' }} />

              <Text style={{ fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, fontFamily: 'Nunito_800ExtraBold' }}>
                TOTAL BUDGET {currentMonth.toUpperCase()}
              </Text>

              {/* Donut + info row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 14 }}>
                <View style={{ width: 90, height: 90, alignItems: 'center', justifyContent: 'center' }}>
                  {Platform.OS === 'web' ? (
                    <DonutSVG pct={overallPct} />
                  ) : (
                    <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 10, borderColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 16, fontWeight: '900', color: '#fff', fontFamily: 'Nunito_900Black' }}>{Math.round(overallPct)}%</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5, fontFamily: 'Nunito_900Black', fontVariant: ['tabular-nums'] as any }}>
                    {formatCurrencyCompact(totalBudget)}
                  </Text>
                  {overCount > 0 && (
                    <Text style={{ fontSize: 11, color: '#FFD4D4', fontWeight: '700', fontFamily: 'Nunito_700Bold', marginTop: 2 }}>{overCount} kategori over budget</Text>
                  )}
                  <View style={{ gap: 4, marginTop: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.85)' }} />
                      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontFamily: 'Nunito_500Medium' }}>
                        Sisa {formatCurrencyCompact(Math.max(remaining, 0))}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' }} />
                      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontFamily: 'Nunito_500Medium' }}>
                        Terpakai {formatCurrencyCompact(totalSpent)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: 12 }} />
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontFamily: 'Nunito_500Medium' }}>
                Sisa bulan ini: <Text style={{ fontWeight: '700', color: '#fff', fontFamily: 'Nunito_700Bold' }}>{daysLeft} hari lagi</Text>
                {dailyRate > 0 ? ` · ${formatCurrencyCompact(dailyRate)}/hari` : ''}
              </Text>
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
              <BudgetCard key={budget.id} budget={budget} onDelete={() => handleDelete(budget)} onEdit={() => setEditBudget(budget)} />
            ))
          )}
        </View>
      </ScrollView>

      <AddBudgetModal visible={addModalVisible} onClose={() => setAddModalVisible(false)} />
      <EditBudgetModal visible={editBudget !== null} budget={editBudget} onClose={() => setEditBudget(null)} />
    </SafeAreaView>
  )
}
