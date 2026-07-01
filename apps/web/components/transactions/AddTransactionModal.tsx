import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Modal, ActivityIndicator, Platform, Dimensions,
} from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateTransaction } from '../../src/hooks/useTransactions'
import { useCategories } from '../../src/hooks/useCategories'
import { resolveIcon } from '../../src/lib/iconMap'
import { useAccounts } from '../../src/hooks/useAccounts'
import { TransactionType, Category, Account } from '../../src/lib/api'
import { format } from 'date-fns'

// ── Saku tokens ────────────────────────────────────────────────
const C = {
  cream:       '#FAF7F2',
  creamSunken: '#F4EEE3',
  surface:     '#FFFFFF',
  primary:     '#6B8E6B',
  primarySoft: '#DEE8D7',
  heroEnd:     '#41594F',
  accent:      '#C97B5C',
  accentSoft:  '#F4DDD0',
  transfer:    '#6E97AE',
  transferSoft:'#DEEAF1',
  danger:      '#C66B6B',
  dangerSoft:  '#F5D9D9',
  fg1:         '#2D2A26',
  fg2:         '#55504A',
  fg3:         '#8E887F',
  fg4:         '#A8A39B',
  border:      '#E0DBD2',
  divider:     '#ECE4D3',
}

function formatAmountInput(text: string): string {
  const digits = text.replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

const transactionSchema = z.object({
  type:       z.enum(['income', 'expense', 'transfer']),
  amount:     z.string().min(1, 'Jumlah wajib diisi')
               .refine((v) => !isNaN(Number(v.replace(/\./g, ''))) && Number(v.replace(/\./g, '')) > 0, { message: 'Jumlah tidak valid' }),
  categoryId: z.string().optional(),
  accountId:  z.string().min(1, 'Pilih rekening'),
  merchant:   z.string().optional(),
  note:       z.string().optional(),
  date:       z.string().min(1, 'Pilih tanggal'),
})

type TransactionFormData = z.infer<typeof transactionSchema>

const TYPE_OPTIONS: Array<{ value: TransactionType; label: string; color: string; soft: string }> = [
  { value: 'expense',  label: '↑ Keluar',    color: C.accent,   soft: C.accentSoft   },
  { value: 'income',   label: '↓ Masuk',     color: C.primary,  soft: C.primarySoft  },
  { value: 'transfer', label: '⇄ Transfer',  color: C.transfer, soft: C.transferSoft },
]

interface Props { visible: boolean; onClose: () => void }

// Breakpoint: ≤600px = mobile bottom-sheet, >600px = centered card
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth > 600 : false
  )
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => setIsDesktop(window.innerWidth > 600)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isDesktop
}

export function AddTransactionModal({ visible, onClose }: Props) {
  const { data: categories = [] } = useCategories()
  const { data: accounts   = [] } = useAccounts()
  const createMutation            = useCreateTransaction()
  const [serverError, setServerError] = useState('')
  const isDesktop = useIsDesktop()

  const { control, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'expense', amount: '', categoryId: '', accountId: '',
      merchant: '', note: '', date: format(new Date(), 'yyyy-MM-dd'),
    },
  })

  const selectedType = watch('type')
  const typeOpt      = TYPE_OPTIONS.find((t) => t.value === selectedType)!
  // Only show categories that match the selected transaction type.
  // transfer shows both income+expense categories (or categories typed 'transfer').
  const filteredCats = (categories as Category[]).filter((c) =>
    selectedType === 'transfer'
      ? true
      : c.type === selectedType
  )

  const handleClose = () => { reset(); setServerError(''); onClose() }

  const onSubmit = (data: TransactionFormData) => {
    setServerError('')
    const amount = parseFloat(data.amount.replace(/\./g, '').replace(',', '.'))
    createMutation.mutate(
      { type: data.type, amount, categoryId: data.categoryId as string, accountId: data.accountId, merchant: data.merchant ?? undefined, note: data.note ?? undefined, date: data.date },
      {
        onSuccess: handleClose,
        onError: (err: any) => setServerError(err.response?.data?.message || 'Gagal menyimpan transaksi'),
      }
    )
  }

  // Desktop: full rounded card. Mobile: bottom sheet (top corners only)
  // flex+overflow:hidden ensures the card respects its maxHeight container
  const cardStyle = isDesktop
    ? { backgroundColor: C.surface, borderRadius: 24, overflow: 'hidden' as const }
    : { backgroundColor: C.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' as const, flex: 1 as any }

  const content = (
    <View style={cardStyle}>
      {/* Handle bar — only on mobile bottom sheet */}
      {!isDesktop && (
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 36, height: 4, borderRadius: 999, backgroundColor: C.border }} />
        </View>
      )}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4,
      }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: C.fg1, fontFamily: 'Nunito_800ExtraBold' }}>
          Tambah Transaksi
        </Text>
        <TouchableOpacity
          onPress={handleClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: C.creamSunken,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 16, color: C.fg2, lineHeight: 18 }}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 1, backgroundColor: C.divider, marginHorizontal: 20, marginTop: 8 }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={Platform.OS === 'web'
          ? {
              // On desktop: limit to 80vh. On mobile: flex:1 fills remaining space inside the 92dvh-capped sheet.
              ...(isDesktop ? { maxHeight: '80vh' as any } : { flex: 1 }),
            }
          : { maxHeight: '82%' as any }
        }
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 24 : 0 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ padding: 20, gap: 16 }}>

          {/* Type toggle */}
          <Controller
            control={control} name="type"
            render={({ field: { value, onChange } }) => (
              <View style={{ flexDirection: 'row', backgroundColor: C.creamSunken, borderRadius: 14, padding: 4 }}>
                {TYPE_OPTIONS.map((opt) => {
                  const active = value === opt.value
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => {
                        if (opt.value !== value) {
                          onChange(opt.value)
                          // Reset category — categories are filtered by type so old selection is invalid
                          setValue('categoryId', '')
                        }
                      }}
                      style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 4, alignItems: 'center', borderRadius: 11, backgroundColor: active ? opt.color : 'transparent' }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: active ? '#fff' : C.fg3, fontFamily: 'Nunito_800ExtraBold' }} numberOfLines={1}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}
          />

          {/* Big amount input */}
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.fg3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, fontFamily: 'Nunito_700Bold' }}>
              Jumlah
            </Text>
            <Controller
              control={control} name="amount"
              render={({ field: { value, onChange } }) => (
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: typeOpt.color, fontFamily: 'Nunito_900Black' }}>Rp</Text>
                  <TextInput
                    style={{ fontSize: 36, fontWeight: '900', color: typeOpt.color, fontFamily: 'Nunito_900Black', minWidth: 80, maxWidth: 220, textAlign: 'center', fontVariant: ['tabular-nums'] as any, borderBottomWidth: 2, borderColor: errors.amount ? C.danger : typeOpt.color, paddingBottom: 4 }}
                    placeholder="0"
                    placeholderTextColor={typeOpt.color + '55'}
                    keyboardType="numeric"
                    value={value}
                    onChangeText={(text) => onChange(formatAmountInput(text))}
                  />
                </View>
              )}
            />
            {errors.amount && <Text style={{ color: C.danger, fontSize: 12, marginTop: 6, fontFamily: 'Nunito_600SemiBold' }}>{errors.amount.message}</Text>}
          </View>

          {/* Category horizontal scroll */}
          <View>
            <Text style={labelStyle}>Kategori <Text style={{ color: C.fg4, fontWeight: '500' }}>(opsional)</Text></Text>
            <Controller
              control={control} name="categoryId"
              render={({ field: { value, onChange } }) => (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => onChange('')}
                      style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 2, backgroundColor: !value ? C.primary : C.creamSunken, borderColor: !value ? C.primary : C.border }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: !value ? '#fff' : C.fg2, fontFamily: 'Nunito_700Bold' }}>Tanpa Kategori</Text>
                    </TouchableOpacity>
                    {filteredCats.length === 0 ? (
                      <View style={{ paddingVertical: 9, paddingHorizontal: 4 }}>
                        <Text style={{ fontSize: 13, color: C.fg4, fontFamily: 'Nunito_500Medium' }}>
                          {`Belum ada kategori untuk ${selectedType === 'income' ? 'pemasukan' : selectedType === 'expense' ? 'pengeluaran' : 'transfer'} — buat di Settings`}
                        </Text>
                      </View>
                    ) : filteredCats.map((cat: Category) => {
                      const active = value === cat.id
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          onPress={() => onChange(cat.id)}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 2, backgroundColor: active ? cat.color : C.creamSunken, borderColor: active ? cat.color : C.border, gap: 6 }}
                        >
                          <Text style={{ fontSize: 16 }}>{resolveIcon(cat.icon)}</Text>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : C.fg2, fontFamily: 'Nunito_700Bold' }}>{cat.name}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </ScrollView>
              )}
            />
          </View>

          {/* Account */}
          <View>
            <Text style={labelStyle}>Rekening</Text>
            <Controller
              control={control} name="accountId"
              render={({ field: { value, onChange } }) => (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {(accounts as Account[]).length === 0 ? (
                    <Text style={{ fontSize: 13, color: C.fg4, fontFamily: 'Nunito_500Medium', paddingVertical: 8 }}>Buat rekening dulu di Settings</Text>
                  ) : (accounts as Account[]).map((acc: Account) => {
                    const active = value === acc.id
                    return (
                      <TouchableOpacity
                        key={acc.id}
                        onPress={() => onChange(acc.id)}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 2, backgroundColor: active ? C.primary : C.creamSunken, borderColor: active ? C.primary : C.border, gap: 6 }}
                      >
                        <Text style={{ fontSize: 16 }}>{(acc as any).icon || '💳'}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : C.fg2, fontFamily: 'Nunito_700Bold' }}>{acc.name}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )}
            />
            {errors.accountId && <Text style={{ color: C.danger, fontSize: 12, marginTop: 4, fontFamily: 'Nunito_600SemiBold' }}>{errors.accountId.message}</Text>}
          </View>

          {/* Merchant */}
          <View>
            <Text style={labelStyle}>Merchant / Toko <Text style={{ color: C.fg4, fontWeight: '500' }}>(opsional)</Text></Text>
            <Controller
              control={control} name="merchant"
              render={({ field: { value, onChange } }) => (
                <TextInput
                  style={inputStyle}
                  placeholder="Contoh: Warung Padang, Grab, Indomaret..."
                  placeholderTextColor={C.fg4}
                  value={value} onChangeText={onChange}
                />
              )}
            />
          </View>

          {/* Note */}
          <View>
            <Text style={labelStyle}>Catatan <Text style={{ color: C.fg4, fontWeight: '500' }}>(opsional)</Text></Text>
            <Controller
              control={control} name="note"
              render={({ field: { value, onChange } }) => (
                <TextInput
                  style={{ ...inputStyle, minHeight: 72, textAlignVertical: 'top' }}
                  placeholder="Tambah catatan..."
                  placeholderTextColor={C.fg4}
                  multiline numberOfLines={2}
                  value={value} onChangeText={onChange}
                />
              )}
            />
          </View>

          {/* Date */}
          <View>
            <Text style={labelStyle}>Tanggal</Text>
            <Controller
              control={control} name="date"
              render={({ field: { value, onChange } }) =>
                typeof window !== 'undefined' ? (
                  <input
                    type="date"
                    value={value}
                    max={format(new Date(), 'yyyy-MM-dd')}
                    onChange={(e) => onChange(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${errors.date ? C.danger : C.border}`, borderRadius: 12, fontSize: 15, color: C.fg1, backgroundColor: C.creamSunken, fontFamily: 'Nunito, system-ui', outline: 'none' }}
                  />
                ) : (
                  <TextInput
                    style={{ ...inputStyle, borderColor: errors.date ? C.danger : C.border }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={C.fg4}
                    value={value} onChangeText={onChange}
                  />
                )
              }
            />
            {errors.date && <Text style={{ color: C.danger, fontSize: 12, marginTop: 4, fontFamily: 'Nunito_600SemiBold' }}>{errors.date.message}</Text>}
          </View>

          {/* Server error */}
          {serverError ? (
            <View style={{ backgroundColor: C.dangerSoft, borderRadius: 12, padding: 12 }}>
              <Text style={{ color: C.danger, fontSize: 13, textAlign: 'center', fontFamily: 'Nunito_600SemiBold' }}>{serverError}</Text>
            </View>
          ) : null}

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit(onSubmit)}
            disabled={createMutation.isPending}
            style={{ backgroundColor: createMutation.isPending ? C.primary + '99' : C.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 4 }}
          >
            {createMutation.isPending
              ? <ActivityIndicator color="white" size="small" />
              : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, fontFamily: 'Nunito_900Black' }}>Simpan Transaksi</Text>}
          </TouchableOpacity>

          <View style={{ height: 24 }} />
        </View>
      </ScrollView>
    </View>
  )

  if (Platform.OS === 'web') {
    if (!visible) return null

    if (isDesktop) {
      // Desktop / tablet: centered modal card
      return (
        <View style={{ position: 'fixed' as any, inset: 0, zIndex: 1000, backgroundColor: 'rgba(45,42,38,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <TouchableOpacity style={{ position: 'absolute' as any, inset: 0 }} onPress={handleClose} activeOpacity={1} />
          <View style={{ width: '100%', maxWidth: 480, zIndex: 1 }}>
            {content}
          </View>
        </View>
      )
    }

    // Mobile web: bottom sheet — must be constrained to viewport so top content is never cut off
    return (
      <View style={{ position: 'fixed' as any, inset: 0, zIndex: 1000, backgroundColor: 'rgba(45,42,38,0.5)', justifyContent: 'flex-end', alignItems: 'center' }}>
        <TouchableOpacity style={{ position: 'absolute' as any, inset: 0 }} onPress={handleClose} activeOpacity={1} />
        <View style={{
          width: '100%', maxWidth: 520, zIndex: 1,
          // Critical: limit height to 92dvh so the sheet never overflows the screen.
          // This ensures the type tabs + amount input at the top are always reachable.
          maxHeight: '92dvh' as any,
          display: 'flex' as any, flexDirection: 'column' as any,
        }}>
          {content}
        </View>
      </View>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(45,42,38,0.5)' }}>
        <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={handleClose} activeOpacity={1} />
        <View style={{ maxHeight: '90%' }}>{content}</View>
      </View>
    </Modal>
  )
}

const labelStyle = { fontSize: 12, fontWeight: '700' as const, color: '#8E887F', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 8, fontFamily: 'Nunito_700Bold' }
const inputStyle = { backgroundColor: '#F4EEE3', borderWidth: 1.5, borderColor: '#E0DBD2', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#2D2A26', fontFamily: 'Nunito_600SemiBold' }
