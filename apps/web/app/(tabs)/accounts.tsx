import { useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Plus, Edit2, Trash2, X, Check, Wallet, CreditCard, Building2, Smartphone, ChevronLeft } from 'lucide-react'
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from '../../src/hooks/useAccounts'
import { formatCurrency } from '../../src/lib/format'
import type { Account } from '../../src/lib/api'

// ─── Config ──────────────────────────────────────────────────────────────────
const ACCOUNT_TYPES = [
  { value: 'bank',    label: 'Bank',       icon: Building2,  color: '#3B82F6' },
  { value: 'ewallet', label: 'E-Wallet',   icon: Smartphone, color: '#8B5CF6' },
  { value: 'cash',    label: 'Tunai',      icon: Wallet,     color: '#10B981' },
  { value: 'credit',  label: 'Kartu Kredit', icon: CreditCard, color: '#EF4444' },
] as const

const COLORS = [
  '#1A2B4A','#3B82F6','#8B5CF6','#10B981',
  '#EF4444','#F59E0B','#EC4899','#14B8A6',
]

function AccountTypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  const cfg = ACCOUNT_TYPES.find((t) => t.value === type) ?? ACCOUNT_TYPES[0]
  const Icon = cfg.icon
  return (
    <View style={{ backgroundColor: cfg.color + '20', borderRadius: 10, padding: 8 }}>
      <Icon size={size} color={cfg.color} />
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
  bankCode: '', accountNumber: '', color: '#1A2B4A', isDefault: false,
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
      balance: String(account.balance),
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
    const balance = parseFloat(form.balance.replace(/[^0-9.-]/g, '')) || 0

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
                <Text className="text-xl font-bold text-slate-900">
                  {isEdit ? 'Edit Rekening' : 'Tambah Rekening'}
                </Text>
                <TouchableOpacity onPress={onClose}>
                  <X size={22} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              {error ? (
                <View className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                  <Text className="text-red-600 text-sm text-center">{error}</Text>
                </View>
              ) : null}

              {/* Account type */}
              <Text className="text-sm font-semibold text-slate-700 mb-2">Jenis Rekening</Text>
              <View className="flex-row gap-2 mb-4">
                {ACCOUNT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => set('type')(t.value)}
                    className={`flex-1 items-center py-3 rounded-xl border ${
                      form.type === t.value
                        ? 'border-primary bg-primary/5'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <t.icon size={18} color={form.type === t.value ? '#1A2B4A' : '#94a3b8'} />
                    <Text className={`text-xs mt-1 font-medium ${
                      form.type === t.value ? 'text-primary' : 'text-slate-400'
                    }`}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Name */}
              <Text className="text-sm font-semibold text-slate-700 mb-2">Nama Rekening</Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 mb-4"
                placeholder="Contoh: BCA Tabungan"
                placeholderTextColor="#94a3b8"
                value={form.name}
                onChangeText={set('name')}
              />

              {/* Balance */}
              <Text className="text-sm font-semibold text-slate-700 mb-2">Saldo Awal</Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 mb-4"
                placeholder="0"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={form.balance}
                onChangeText={set('balance')}
              />

              {/* Bank code & account number (for bank type) */}
              {(form.type === 'bank' || form.type === 'credit') && (
                <>
                  <Text className="text-sm font-semibold text-slate-700 mb-2">Kode Bank</Text>
                  <TextInput
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 mb-4"
                    placeholder="Contoh: BCA, MANDIRI, BRI"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="characters"
                    value={form.bankCode}
                    onChangeText={set('bankCode')}
                  />
                  <Text className="text-sm font-semibold text-slate-700 mb-2">Nomor Rekening</Text>
                  <TextInput
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 mb-4"
                    placeholder="Contoh: 1234567890"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={form.accountNumber}
                    onChangeText={set('accountNumber')}
                  />
                </>
              )}

              {/* Color */}
              <Text className="text-sm font-semibold text-slate-700 mb-2">Warna</Text>
              <View className="flex-row gap-2 mb-4">
                {COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => set('color')(c)}
                    style={{ backgroundColor: c, width: 32, height: 32, borderRadius: 16,
                      borderWidth: form.color === c ? 3 : 0, borderColor: 'white',
                      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4 }}
                  >
                    {form.color === c && (
                      <View className="flex-1 items-center justify-center">
                        <Check size={14} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Default toggle */}
              <TouchableOpacity
                onPress={() => set('isDefault')(!form.isDefault)}
                className={`flex-row items-center justify-between p-4 rounded-xl mb-6 ${
                  form.isDefault ? 'bg-primary/10 border border-primary/20' : 'bg-slate-50 border border-slate-200'
                }`}
              >
                <Text className={`font-medium ${form.isDefault ? 'text-primary' : 'text-slate-600'}`}>
                  Jadikan rekening utama
                </Text>
                <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                  form.isDefault ? 'bg-primary border-primary' : 'border-slate-300'
                }`}>
                  {form.isDefault && <Check size={12} color="white" />}
                </View>
              </TouchableOpacity>

              {/* Save button */}
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
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-primary px-5 pt-4 pb-8">
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
            className="bg-white rounded-2xl p-4 mb-4 flex-row items-center shadow-sm border border-slate-100"
          >
            <View className="w-10 h-10 bg-primary/10 rounded-xl items-center justify-center mr-3">
              <Plus size={20} color="#1A2B4A" />
            </View>
            <Text className="text-primary font-semibold text-base">Tambah Rekening Baru</Text>
          </TouchableOpacity>

          {/* Account list */}
          {isLoading ? (
            <View className="py-10 items-center">
              <ActivityIndicator color="#1A2B4A" />
            </View>
          ) : (accounts ?? []).length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center shadow-sm">
              <Wallet size={40} color="#cbd5e1" />
              <Text className="text-slate-400 mt-3 font-medium">Belum ada rekening</Text>
              <Text className="text-slate-300 text-sm mt-1">Tambahkan rekening bank atau e-wallet kamu</Text>
            </View>
          ) : (
            <View className="gap-3 mb-6">
              {(accounts ?? []).map((acc) => (
                <View key={acc.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-50">
                  <View className="flex-row items-center">
                    <AccountTypeIcon type={acc.type} />
                    <View className="flex-1 ml-3">
                      <View className="flex-row items-center">
                        <Text className="text-slate-900 font-semibold text-base">{acc.name}</Text>
                        {(acc as any).isDefault && (
                          <View className="ml-2 bg-primary/10 px-2 py-0.5 rounded-full">
                            <Text className="text-primary text-xs font-medium">Utama</Text>
                          </View>
                        )}
                      </View>
                      {(acc as any).accountNumber && (
                        <Text className="text-slate-400 text-xs mt-0.5">
                          •••• {String((acc as any).accountNumber).slice(-4)}
                        </Text>
                      )}
                    </View>
                    <View className="items-end">
                      <Text className="text-slate-900 font-bold font-mono">
                        {formatCurrency(acc.balance)}
                      </Text>
                      <View className="flex-row mt-2 gap-2">
                        <TouchableOpacity
                          onPress={() => handleEdit(acc)}
                          className="w-8 h-8 bg-blue-50 rounded-lg items-center justify-center"
                        >
                          <Edit2 size={14} color="#3b82f6" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setConfirmDelete(acc)}
                          className="w-8 h-8 bg-red-50 rounded-lg items-center justify-center"
                        >
                          <Trash2 size={14} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                  {/* Color bar */}
                  <View style={{ backgroundColor: acc.color, height: 3, borderRadius: 2, marginTop: 12 }} />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Form modal */}
      <AccountFormModal
        visible={showForm}
        account={editAccount}
        onClose={handleCloseForm}
      />

      {/* Delete confirm modal */}
      <Modal visible={!!confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(null)}>
        <View className="flex-1 bg-black/40 items-center justify-center px-6">
          <View className="bg-white rounded-2xl p-6 w-full">
            <Text className="text-lg font-bold text-slate-900 mb-2">Hapus Rekening?</Text>
            <Text className="text-slate-500 text-sm mb-6">
              Rekening <Text className="font-semibold">{confirmDelete?.name}</Text> akan dihapus.
              Transaksi yang terkait tidak ikut terhapus.
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setConfirmDelete(null)}
                className="flex-1 py-3 rounded-xl border border-slate-200 items-center"
              >
                <Text className="text-slate-600 font-medium">Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => confirmDelete && handleDelete(confirmDelete)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-3 rounded-xl bg-red-500 items-center"
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
