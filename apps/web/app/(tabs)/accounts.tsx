import { useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from '../../src/hooks/useAccounts'
import { formatCurrency } from '../../src/lib/format'
import type { Account } from '../../src/lib/api'

function formatBalanceInput(text: string): string {
  const digits = text.replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// ─── Config ──────────────────────────────────────────────────────────────────
const ACCOUNT_TYPES = [
  { value: 'bank',    label: 'Bank',         icon: '🏦', color: '#6E97AE' },
  { value: 'ewallet', label: 'E-Wallet',     icon: '📱', color: '#D9A441' },
  { value: 'cash',    label: 'Tunai',        icon: '💵', color: '#6B8E6B' },
  { value: 'credit',  label: 'Kartu Kredit', icon: '💳', color: '#C97B5C' },
] as const

const COLORS = [
  '#C97B5C', '#6B8E6B', '#D9A441', '#6E97AE',
  '#C66B6B', '#7E4F94', '#41594F', '#A8624A',
]

function AccountTypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  const cfg = ACCOUNT_TYPES.find((t) => t.value === type) ?? ACCOUNT_TYPES[0]
  return (
    <View style={{ backgroundColor: cfg.color + '20', borderRadius: 10, padding: 8 }}>
      <Text style={{ fontSize: size }}>{cfg.icon}</Text>
    </View>
  )
}

// ─── Form Modal ───────────────────────────────────────────────────────────────
interface AccountForm {
  name: string
  type: 'bank' | 'ewallet' | 'cash' | 'credit'
  balance: string
  bankCode: string
  accountNumber: string
  color: string
  isDefault: boolean
}

const defaultForm: AccountForm = {
  name: '', type: 'bank', balance: '0',
  bankCode: '', accountNumber: '', color: '#6B8E6B', isDefault: false,
}

function AccountFormModal({
  visible, account, onClose,
}: {
  visible: boolean
  account: Account | null
  onClose: () => void
}) {
  const isEdit = !!account
  const [form, setForm] = useState<AccountForm>(
    account ? {
      name: account.name,
      type: account.type as AccountForm['type'],
      balance: formatBalanceInput(String(Math.round(account.balance))),
      bankCode: (account as any).bankCode ?? '',
      accountNumber: (account as any).accountNumber ?? '',
      color: account.color,
      isDefault: (account as any).isDefault ?? false,
    } : defaultForm
  )
  const [error, setError] = useState('')

  const createMutation = useCreateAccount()
  const updateMutation = useUpdateAccount()
  const isPending = createMutation.isPending || updateMutation.isPending

  const set = (key: keyof AccountForm) => (val: string | boolean) =>
    setForm((f) => ({ ...f, [key]: val }))

  const handleSave = async () => {
    setError('')
    if (!form.name.trim()) { setError('Nama rekening wajib diisi'); return }
    const balance = parseFloat(form.balance.replace(/\./g, '')) || 0

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          id: account!.id,
          data: {
            name: form.name.trim(),
            type: form.type,
            balance,
            bankCode: form.bankCode.trim() || undefined,
            accountNumber: form.accountNumber.trim() || undefined,
            color: form.color,
            isDefault: form.isDefault,
          },
        })
      } else {
        await createMutation.mutateAsync({
          name: form.name.trim(),
          type: form.type,
          balance,
          bankCode: form.bankCode.trim() || undefined,
          accountNumber: form.accountNumber.trim() || undefined,
          color: form.color,
          isDefault: form.isDefault,
        })
      }
      onClose()
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Gagal menyimpan')
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-white rounded-t-3xl" style={{ maxHeight: '90%' }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View className="p-6">
              {/* Header */}
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-xl font-bold text-ink-900">
                  {isEdit ? 'Edit Rekening' : 'Tambah Rekening'}
                </Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontSize: 20, color: '#A8A39B', lineHeight: 24 }}>✕</Text>
                </TouchableOpacity>
              </View>

              {error ? (
                <View style={{ backgroundColor: 'rgba(198,107,107,0.1)', borderWidth: 1, borderColor: '#C66B6B', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                  <Text style={{ color: '#C66B6B', fontSize: 13, textAlign: 'center' }}>{error}</Text>
                </View>
              ) : null}

              {/* Account type */}
              <Text className="text-sm font-semibold text-ink-700 mb-2">Jenis Rekening</Text>
              <View className="flex-row gap-2 mb-4">
                {ACCOUNT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => set('type')(t.value)}
                    className={`flex-1 items-center py-3 rounded-xl border ${
                      form.type === t.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-canvas-200'
                    }`}
                  >
                    <Text style={{ fontSize: 18 }}>{t.icon}</Text>
                    <Text className={`text-xs mt-1 font-medium ${
                      form.type === t.value ? 'text-primary' : 'text-ink-400'
                    }`}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Name */}
              <Text className="text-sm font-semibold text-ink-700 mb-2">Nama Rekening</Text>
              <TextInput
                className="bg-canvas-200 border border-border rounded-xl px-4 py-3.5 text-ink-900 mb-4"
                placeholder="Contoh: BCA Tabungan"
                placeholderTextColor="#A8A39B"
                value={form.name}
                onChangeText={set('name')}
              />

              {/* Balance */}
              <Text className="text-sm font-semibold text-ink-700 mb-2">Saldo Awal</Text>
              <TextInput
                className="bg-canvas-200 border border-border rounded-xl px-4 py-3.5 text-ink-900 mb-4"
                placeholder="0"
                placeholderTextColor="#A8A39B"
                keyboardType="numeric"
                value={form.balance}
                onChangeText={(text) => set('balance')(formatBalanceInput(text))}
              />

              {(form.type === 'bank' || form.type === 'credit') && (
                <>
                  <Text className="text-sm font-semibold text-ink-700 mb-2">Kode Bank</Text>
                  <TextInput
                    className="bg-canvas-200 border border-border rounded-xl px-4 py-3.5 text-ink-900 mb-4"
                    placeholder="Contoh: BCA, MANDIRI, BRI"
                    placeholderTextColor="#A8A39B"
                    autoCapitalize="characters"
                    value={form.bankCode}
                    onChangeText={set('bankCode')}
                  />
                  <Text className="text-sm font-semibold text-ink-700 mb-2">Nomor Rekening</Text>
                  <TextInput
                    className="bg-canvas-200 border border-border rounded-xl px-4 py-3.5 text-ink-900 mb-4"
                    placeholder="Contoh: 1234567890"
                    placeholderTextColor="#A8A39B"
                    keyboardType="numeric"
                    value={form.accountNumber}
                    onChangeText={set('accountNumber')}
                  />
                </>
              )}

              {/* Color */}
              <Text className="text-sm font-semibold text-ink-700 mb-2">Warna</Text>
              <View className="flex-row gap-2 mb-4">
                {COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => set('color')(c)}
                    style={{
                      backgroundColor: c, width: 32, height: 32, borderRadius: 16,
                      borderWidth: form.color === c ? 3 : 0, borderColor: 'white',
                      shadowColor: '#2D2A26', shadowOpacity: 0.15, shadowRadius: 4,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {form.color === c && (
                      <Text style={{ color: 'white', fontSize: 12, fontWeight: '700', lineHeight: 16 }}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Default toggle */}
              <TouchableOpacity
                onPress={() => set('isDefault')(!form.isDefault)}
                className={`flex-row items-center justify-between p-4 rounded-xl mb-6 ${
                  form.isDefault ? 'bg-primary/10 border border-primary/20' : 'bg-canvas-200 border border-border'
                }`}
              >
                <Text className={`font-medium ${form.isDefault ? 'text-primary' : 'text-ink-600'}`}>
                  Jadikan rekening utama
                </Text>
                <View
                  className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                    form.isDefault ? 'bg-primary border-primary' : 'border-ink-300'
                  }`}
                >
                  {form.isDefault && (
                    <Text style={{ color: 'white', fontSize: 10, fontWeight: '700', lineHeight: 14 }}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave}
                disabled={isPending}
                className={`rounded-xl py-4 items-center ${isPending ? 'bg-primary/60' : 'bg-primary'}`}
              >
                {isPending
                  ? <ActivityIndicator color="white" />
                  : <Text className="text-white font-bold text-base">
                      {isEdit ? 'Simpan Perubahan' : 'Tambah Rekening'}
                    </Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AccountsScreen() {
  const { data: accounts, isLoading } = useAccounts()
  const deleteMutation = useDeleteAccount()
  const [showForm, setShowForm] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Account | null>(null)

  const totalBalance = (accounts ?? []).reduce((sum, a) => sum + a.balance, 0)

  const handleEdit = (acc: Account) => {
    setEditAccount(acc)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditAccount(null)
  }

  const handleDelete = async (acc: Account) => {
    await deleteMutation.mutateAsync(acc.id)
    setConfirmDelete(null)
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-primary px-5 pt-4 pb-8">
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row items-center mb-3 self-start"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ fontSize: 22, color: 'rgba(255,255,255,0.8)', lineHeight: 26 }}>‹</Text>
            <Text className="text-white/80 text-sm font-semibold ml-0.5">Kembali</Text>
          </TouchableOpacity>
          <Text className="text-white/70 text-sm mb-1">Total Saldo</Text>
          <Text className="text-white text-3xl font-bold font-mono mb-1">
            {formatCurrency(totalBalance)}
          </Text>
          <Text className="text-white/60 text-xs">{(accounts ?? []).length} rekening aktif</Text>
        </View>

        <View className="px-4 -mt-4">
          {/* Add button */}
          <TouchableOpacity
            onPress={() => setShowForm(true)}
            className="bg-white rounded-2xl p-4 mb-4 flex-row items-center shadow-sm"
            style={{ borderWidth: 1, borderColor: '#E0DBD2' }}
          >
            <View className="w-10 h-10 bg-primary/10 rounded-xl items-center justify-center mr-3">
              <Text style={{ fontSize: 22, color: '#6B8E6B', lineHeight: 26 }}>+</Text>
            </View>
            <Text className="text-primary font-semibold text-base">Tambah Rekening Baru</Text>
          </TouchableOpacity>

          {/* Account list */}
          {isLoading ? (
            <View className="py-10 items-center">
              <ActivityIndicator color="#6B8E6B" />
            </View>
          ) : (accounts ?? []).length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center shadow-sm">
              <Text style={{ fontSize: 40 }}>👛</Text>
              <Text className="text-ink-400 mt-3 font-medium">Belum ada rekening</Text>
              <Text className="text-ink-300 text-sm mt-1">Tambahkan rekening bank atau e-wallet kamu</Text>
            </View>
          ) : (
            <View className="gap-3 mb-6">
              {(accounts ?? []).map((acc) => (
                <View key={acc.id} className="bg-white rounded-2xl p-4 shadow-sm" style={{ borderWidth: 1, borderColor: '#ECE4D3' }}>
                  <View className="flex-row items-center">
                    <AccountTypeIcon type={acc.type} />
                    <View className="flex-1 ml-3">
                      <View className="flex-row items-center">
                        <Text className="text-ink-900 font-semibold text-base">{acc.name}</Text>
                        {(acc as any).isDefault && (
                          <View className="ml-2 bg-primary/10 px-2 py-0.5 rounded-full">
                            <Text className="text-primary text-xs font-medium">Utama</Text>
                          </View>
                        )}
                      </View>
                      {(acc as any).accountNumber && (
                        <Text className="text-ink-400 text-xs mt-0.5">
                          •••• {String((acc as any).accountNumber).slice(-4)}
                        </Text>
                      )}
                    </View>
                    <View className="items-end">
                      <Text className="text-ink-900 font-bold font-mono">
                        {formatCurrency(acc.balance)}
                      </Text>
                      <View className="flex-row mt-2 gap-2">
                        <TouchableOpacity
                          onPress={() => handleEdit(acc)}
                          className="w-8 h-8 bg-primary/10 rounded-lg items-center justify-center"
                        >
                          <Text style={{ fontSize: 14, color: '#6B8E6B' }}>✎</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setConfirmDelete(acc)}
                          className="w-8 h-8 rounded-lg items-center justify-center"
                          style={{ backgroundColor: 'rgba(198,107,107,0.1)' }}
                        >
                          <Text style={{ fontSize: 13, color: '#C66B6B' }}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                  <View style={{ backgroundColor: acc.color, height: 3, borderRadius: 2, marginTop: 12 }} />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <AccountFormModal
        visible={showForm}
        account={editAccount}
        onClose={handleCloseForm}
      />

      <Modal visible={!!confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(null)}>
        <View className="flex-1 bg-black/40 items-center justify-center px-6">
          <View className="bg-white rounded-2xl p-6 w-full">
            <Text className="text-lg font-bold text-ink-900 mb-2">Hapus Rekening?</Text>
            <Text className="text-ink-500 text-sm mb-6">
              Rekening <Text className="font-semibold">{confirmDelete?.name}</Text> akan dihapus.
              Transaksi yang terkait tidak ikut terhapus.
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setConfirmDelete(null)}
                className="flex-1 py-3 rounded-xl border border-border items-center"
              >
                <Text className="text-ink-600 font-medium">Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => confirmDelete && handleDelete(confirmDelete)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-3 rounded-xl items-center"
                style={{ backgroundColor: '#C66B6B' }}
              >
                {deleteMutation.isPending
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text className="text-white font-bold">Hapus</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
