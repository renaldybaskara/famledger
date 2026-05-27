import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Check } from 'lucide-react'
import { useCreateTransaction } from '../../src/hooks/useTransactions'
import { useCategories } from '../../src/hooks/useCategories'
import { useAccounts } from '../../src/hooks/useAccounts'
import { TransactionType, Category, Account } from '../../src/lib/api'
import { format } from 'date-fns'

const transactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z
    .string()
    .min(1, 'Jumlah wajib diisi')
    .refine((v) => !isNaN(Number(v.replace(/\./g, '').replace(',', '.'))) && Number(v.replace(/\./g, '').replace(',', '.')) > 0, {
      message: 'Masukkan jumlah yang valid',
    }),
  categoryId: z.string().min(1, 'Pilih kategori'),
  accountId: z.string().min(1, 'Pilih akun'),
  merchant: z.string().optional(),
  note: z.string().optional(),
  date: z.string().min(1, 'Pilih tanggal'),
})

type TransactionFormData = z.infer<typeof transactionSchema>

interface AddTransactionModalProps {
  visible: boolean
  onClose: () => void
}

const TYPE_OPTIONS: Array<{ value: TransactionType; label: string; color: string }> = [
  { value: 'expense', label: 'Pengeluaran', color: '#EF4444' },
  { value: 'income', label: 'Pemasukan', color: '#10B981' },
  { value: 'transfer', label: 'Transfer', color: '#6366F1' },
]

export function AddTransactionModal({ visible, onClose }: AddTransactionModalProps) {
  const { data: categories = [] } = useCategories()
  const { data: accounts = [] } = useAccounts()
  const createMutation = useCreateTransaction()
  const [serverError, setServerError] = useState('')

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'expense',
      amount: '',
      categoryId: '',
      accountId: '',
      merchant: '',
      note: '',
      date: format(new Date(), 'yyyy-MM-dd'),
    },
  })

  const selectedType = watch('type')
  const filteredCategories = categories.filter(
    (c: Category) => c.type === selectedType || selectedType === 'transfer'
  )

  const handleClose = () => {
    reset()
    setServerError('')
    onClose()
  }

  const onSubmit = (data: TransactionFormData) => {
    setServerError('')
    const amount = parseFloat(data.amount.replace(/\./g, '').replace(',', '.'))
    createMutation.mutate(
      {
        type: data.type,
        amount,
        categoryId: data.categoryId,
        accountId: data.accountId,
        merchant: data.merchant || undefined,
        note: data.note || undefined,
        date: data.date,
      },
      {
        onSuccess: () => {
          handleClose()
        },
        onError: (err: any) => {
          setServerError(err.response?.data?.message || 'Gagal menyimpan transaksi')
        },
      }
    )
  }

  const content = (
    <View className="flex-1 bg-white rounded-t-3xl">
      {/* Handle bar */}
      <View className="items-center pt-3 pb-1">
        <View className="w-10 h-1 bg-slate-200 rounded-full" />
      </View>

      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3 border-b border-slate-100">
        <Text className="text-lg font-bold text-slate-800">Tambah Transaksi</Text>
        <TouchableOpacity
          onPress={handleClose}
          className="w-8 h-8 bg-slate-100 rounded-full items-center justify-center"
        >
          <X size={16} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <View className="py-4 gap-4">
          {/* Type selector */}
          <View>
            <Text className="text-slate-600 text-sm font-medium mb-2">Jenis Transaksi</Text>
            <Controller
              control={control}
              name="type"
              render={({ field: { value, onChange } }) => (
                <View className="flex-row gap-2">
                  {TYPE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => onChange(opt.value)}
                      className={`flex-1 py-2.5 rounded-xl items-center border-2 ${
                        value === opt.value ? 'border-transparent' : 'border-slate-200 bg-slate-50'
                      }`}
                      style={
                        value === opt.value
                          ? { backgroundColor: opt.color, borderColor: opt.color }
                          : {}
                      }
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

          {/* Amount */}
          <View>
            <Text className="text-slate-600 text-sm font-medium mb-2">Jumlah (Rp)</Text>
            <Controller
              control={control}
              name="amount"
              render={({ field: { value, onChange } }) => (
                <TextInput
                  className={`bg-slate-50 border rounded-xl px-4 py-3.5 text-slate-900 text-lg font-mono ${
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

          {/* Category */}
          <View>
            <Text className="text-slate-600 text-sm font-medium mb-2">Kategori</Text>
            <Controller
              control={control}
              name="categoryId"
              render={({ field: { value, onChange } }) => (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2 pb-1">
                    {filteredCategories.length === 0 ? (
                      <Text className="text-slate-400 text-sm italic py-2">
                        Tidak ada kategori tersedia
                      </Text>
                    ) : (
                      filteredCategories.map((cat: Category) => (
                        <TouchableOpacity
                          key={cat.id}
                          onPress={() => onChange(cat.id)}
                          className={`flex-row items-center px-3 py-2 rounded-xl border-2 ${
                            value === cat.id ? 'border-transparent' : 'border-slate-200 bg-slate-50'
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
                      ))
                    )}
                  </View>
                </ScrollView>
              )}
            />
            {errors.categoryId && (
              <Text className="text-red-500 text-xs mt-1">{errors.categoryId.message}</Text>
            )}
          </View>

          {/* Account */}
          <View>
            <Text className="text-slate-600 text-sm font-medium mb-2">Akun</Text>
            <Controller
              control={control}
              name="accountId"
              render={({ field: { value, onChange } }) => (
                <View className="flex-row flex-wrap gap-2">
                  {accounts.length === 0 ? (
                    <Text className="text-slate-400 text-sm italic py-2">
                      Tidak ada akun tersedia
                    </Text>
                  ) : (
                    accounts.map((acc: Account) => (
                      <TouchableOpacity
                        key={acc.id}
                        onPress={() => onChange(acc.id)}
                        className={`flex-row items-center px-3 py-2 rounded-xl border-2 ${
                          value === acc.id
                            ? 'bg-primary border-primary'
                            : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <Text style={{ fontSize: 14 }}>{acc.icon || '💳'}</Text>
                        <Text
                          className={`ml-1.5 text-sm font-medium ${
                            value === acc.id ? 'text-white' : 'text-slate-600'
                          }`}
                        >
                          {acc.name}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            />
            {errors.accountId && (
              <Text className="text-red-500 text-xs mt-1">{errors.accountId.message}</Text>
            )}
          </View>

          {/* Merchant */}
          <View>
            <Text className="text-slate-600 text-sm font-medium mb-2">
              Merchant / Toko <Text className="text-slate-400 font-normal">(opsional)</Text>
            </Text>
            <Controller
              control={control}
              name="merchant"
              render={({ field: { value, onChange } }) => (
                <TextInput
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
                  placeholder="Contoh: Indomaret, Grab Food..."
                  placeholderTextColor="#94a3b8"
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
          </View>

          {/* Note */}
          <View>
            <Text className="text-slate-600 text-sm font-medium mb-2">
              Catatan <Text className="text-slate-400 font-normal">(opsional)</Text>
            </Text>
            <Controller
              control={control}
              name="note"
              render={({ field: { value, onChange } }) => (
                <TextInput
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
                  placeholder="Tambah catatan..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={2}
                  value={value}
                  onChangeText={onChange}
                  style={{ minHeight: 72, textAlignVertical: 'top' }}
                />
              )}
            />
          </View>

          {/* Date */}
          <View>
            <Text className="text-slate-600 text-sm font-medium mb-2">Tanggal</Text>
            <Controller
              control={control}
              name="date"
              render={({ field: { value, onChange } }) => (
                <TextInput
                  className={`bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 ${
                    errors.date ? 'border-red-400' : 'border-slate-200'
                  }`}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  value={value}
                  onChangeText={onChange}
                  // On web, type=date via nativeID trick — handled via platform
                  {...(Platform.OS === 'web'
                    ? ({ type: 'date', max: format(new Date(), 'yyyy-MM-dd') } as any)
                    : {})}
                />
              )}
            />
            {errors.date && (
              <Text className="text-red-500 text-xs mt-1">{errors.date.message}</Text>
            )}
          </View>

          {/* Server error */}
          {serverError ? (
            <View className="bg-red-50 border border-red-200 rounded-xl p-3">
              <Text className="text-red-600 text-sm text-center">{serverError}</Text>
            </View>
          ) : null}

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit(onSubmit)}
            disabled={createMutation.isPending}
            className={`rounded-xl py-4 items-center flex-row justify-center gap-2 ${
              createMutation.isPending ? 'bg-primary/60' : 'bg-primary'
            }`}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Check size={18} color="white" />
                <Text className="text-white font-semibold text-base">Simpan Transaksi</Text>
              </>
            )}
          </TouchableOpacity>

          <View className="h-8" />
        </View>
      </ScrollView>
    </View>
  )

  if (Platform.OS === 'web') {
    // On web, render as a bottom sheet overlay
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
            maxHeight: '90vh' as any,
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
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View className="flex-1 justify-end bg-black/50">
        <TouchableOpacity
          className="absolute inset-0"
          onPress={handleClose}
          activeOpacity={1}
        />
        <KeyboardAvoidingView
          behavior="padding"
          style={{ maxHeight: '90%' }}
        >
          {content}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}
