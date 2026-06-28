import { useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from '../../src/hooks/useAccounts'
import { formatCurrency } from '../../src/lib/format'
import { useAuthStore } from '../../src/store/auth.store'
import type { Account } from '../../src/lib/api'

const C = {
  cream: '#FAF7F2', creamSunken: '#F4EEE3', surface: '#FFFFFF',
  primary: '#6B8E6B', primarySoft: '#DEE8D7', heroEnd: '#41594F',
  accent: '#C97B5C', accentSoft: '#F4DDD0',
  danger: '#C66B6B', dangerSoft: 'rgba(198,107,107,0.1)',
  mustard: '#D9A441', mustardSoft: '#FBEFD2',
  fg1: '#2D2A26', fg2: '#55504A', fg3: '#8E887F', fg4: '#A8A39B',
  border: '#E0DBD2', divider: '#ECE4D3',
}

// ─── 3 account types only ────────────────────────────────────────────────────
const ACCOUNT_TYPES = [
  {
    value: 'bank',
    label: 'Tabungan',
    icon: '🏦',
    color: '#6E97AE',
    desc: 'Rekening tabungan bank',
    balanceLabel: 'Saldo',
  },
  {
    value: 'credit',
    label: 'Kartu Kredit',
    icon: '💳',
    color: '#C97B5C',
    desc: 'Kartu kredit',
    balanceLabel: 'Limit Kartu',
  },
  {
    value: 'investment',
    label: 'Investasi',
    icon: '📈',
    color: '#6B8E6B',
    desc: 'Saham, reksa dana, kripto',
    balanceLabel: 'Nilai Investasi Bulan Ini',
  },
] as const

type AccountType = 'bank' | 'credit' | 'investment'

const COLORS = [
  '#6E97AE', '#6B8E6B', '#D9A441', '#C97B5C',
  '#C66B6B', '#7E4F94', '#41594F', '#A8624A',
]

function formatBalanceInput(text: string): string {
  const digits = text.replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function getTypeCfg(type: string) {
  return ACCOUNT_TYPES.find((t) => t.value === type) ?? ACCOUNT_TYPES[0]
}

// ─── Form Modal ───────────────────────────────────────────────────────────────
interface AccountForm {
  name: string
  type: AccountType
  balance: string
  bankCode: string
  accountNumber: string
  color: string
  isDefault: boolean
}

const defaultForm: AccountForm = {
  name: '', type: 'bank', balance: '0',
  bankCode: '', accountNumber: '', color: '#6E97AE', isDefault: false,
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
      type: (account.type as AccountType) ?? 'bank',
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

  const typeCfg = getTypeCfg(form.type)

  const handleSave = async () => {
    setError('')
    if (!form.name.trim()) { setError('Nama rekening wajib diisi'); return }
    const balance = form.type === 'investment'
      ? (parseFloat(form.balance.replace(/\./g, '')) || 0)
      : 0

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
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={{ padding: 24 }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <Text style={{ fontSize: 20, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: C.fg1 }}>
                  {isEdit ? 'Edit Rekening' : 'Tambah Rekening'}
                </Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontSize: 20, color: C.fg4, lineHeight: 24 }}>✕</Text>
                </TouchableOpacity>
              </View>

              {error ? (
                <View style={{ backgroundColor: C.dangerSoft, borderWidth: 1, borderColor: C.danger, borderRadius: 12, padding: 12, marginBottom: 16 }}>
                  <Text style={{ color: C.danger, fontSize: 13, textAlign: 'center' }}>{error}</Text>
                </View>
              ) : null}

              {/* Account type — 3 options */}
              <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: C.fg2, marginBottom: 10 }}>Jenis Rekening</Text>
              <View style={{ gap: 8, marginBottom: 20 }}>
                {ACCOUNT_TYPES.map((t) => {
                  const selected = form.type === t.value
                  return (
                    <TouchableOpacity
                      key={t.value}
                      onPress={() => set('type')(t.value)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: selected ? C.primary : C.border,
                        backgroundColor: selected ? C.primarySoft : C.creamSunken,
                      }}
                    >
                      <Text style={{ fontSize: 22, marginRight: 12 }}>{t.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: selected ? C.heroEnd : C.fg1 }}>
                          {t.label}
                        </Text>
                        <Text style={{ fontSize: 11, color: C.fg3, fontFamily: 'Nunito_500Medium', marginTop: 1 }}>{t.desc}</Text>
                      </View>
                      <View style={{
                        width: 20, height: 20, borderRadius: 999, borderWidth: 2,
                        borderColor: selected ? C.primary : C.fg4,
                        backgroundColor: selected ? C.primary : 'transparent',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        {selected && <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', lineHeight: 14 }}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Name */}
              <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: C.fg2, marginBottom: 8 }}>Nama Rekening</Text>
              <TextInput
                style={{ backgroundColor: C.creamSunken, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: C.fg1, marginBottom: 16, fontFamily: 'Nunito_500Medium' }}
                placeholder={
                  form.type === 'bank' ? 'Contoh: BCA Tahapan' :
                  form.type === 'credit' ? 'Contoh: Mandiri Visa' :
                  'Contoh: Saham BBCA, Kripto BTC'
                }
                placeholderTextColor={C.fg4}
                value={form.name}
                onChangeText={set('name')}
              />

              {/* Investment amount only */}
              {form.type === 'investment' && (
                <>
                  <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: C.fg2, marginBottom: 4 }}>
                    Nilai Investasi Saat Ini
                  </Text>
                  <Text style={{ fontSize: 11, color: C.fg3, fontFamily: 'Nunito_500Medium', marginBottom: 8 }}>
                    Nilai portofolio saat ini. Kamu akan diingatkan update setiap awal bulan.
                  </Text>
                  <TextInput
                    style={{ backgroundColor: C.creamSunken, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: C.fg1, marginBottom: 16, fontFamily: 'Nunito_500Medium' }}
                    placeholder="0"
                    placeholderTextColor={C.fg4}
                    keyboardType="numeric"
                    value={form.balance}
                    onChangeText={(text) => set('balance')(formatBalanceInput(text))}
                  />
                </>
              )}

              {/* Credit card: card number last 4 only (for email matching) */}
              {form.type === 'credit' && (
                <>
                  <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: C.fg2, marginBottom: 4 }}>
                    4 Digit Terakhir Kartu
                  </Text>
                  <Text style={{ fontSize: 11, color: C.fg3, fontFamily: 'Nunito_500Medium', marginBottom: 8 }}>
                    Digunakan untuk mencocokkan notifikasi email kartu kredit.
                  </Text>
                  <TextInput
                    style={{ backgroundColor: C.creamSunken, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: C.fg1, marginBottom: 16, fontFamily: 'Nunito_500Medium' }}
                    placeholder="Contoh: 2609"
                    placeholderTextColor={C.fg4}
                    keyboardType="numeric"
                    maxLength={4}
                    value={form.accountNumber}
                    onChangeText={set('accountNumber')}
                  />
                  <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: C.fg2, marginBottom: 8 }}>
                    Kode Bank
                  </Text>
                  <TextInput
                    style={{ backgroundColor: C.creamSunken, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: C.fg1, marginBottom: 16, fontFamily: 'Nunito_500Medium' }}
                    placeholder="Contoh: BCA, MANDIRI, BRI"
                    placeholderTextColor={C.fg4}
                    autoCapitalize="characters"
                    value={form.bankCode}
                    onChangeText={set('bankCode')}
                  />
                </>
              )}

              {/* Color */}
              <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: C.fg2, marginBottom: 8 }}>Warna</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
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
                    {form.color === c && <Text style={{ color: 'white', fontSize: 12, fontWeight: '700', lineHeight: 16 }}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Default toggle — only for bank accounts */}
              {form.type === 'bank' && (
                <TouchableOpacity
                  onPress={() => set('isDefault')(!form.isDefault)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    padding: 16, borderRadius: 14, marginBottom: 20,
                    backgroundColor: form.isDefault ? C.primarySoft : C.creamSunken,
                    borderWidth: 1, borderColor: form.isDefault ? C.primary : C.border,
                  }}
                >
                  <Text style={{ fontWeight: '500', fontFamily: 'Nunito_500Medium', color: form.isDefault ? C.primary : C.fg2 }}>
                    Jadikan rekening utama
                  </Text>
                  <View style={{
                    width: 20, height: 20, borderRadius: 999, borderWidth: 2,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: form.isDefault ? C.primary : 'transparent',
                    borderColor: form.isDefault ? C.primary : C.fg3,
                  }}>
                    {form.isDefault && <Text style={{ color: 'white', fontSize: 10, fontWeight: '700', lineHeight: 14 }}>✓</Text>}
                  </View>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleSave}
                disabled={isPending}
                style={{ borderRadius: 14, paddingVertical: 16, alignItems: 'center', backgroundColor: isPending ? C.primary + '99' : C.primary }}
              >
                {isPending
                  ? <ActivityIndicator color="white" />
                  : <Text style={{ color: '#fff', fontWeight: '700', fontFamily: 'Nunito_700Bold', fontSize: 15 }}>
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


// ─── Investment Monthly Update Popup ─────────────────────────────────────────
function InvestmentUpdatePopup({
  accounts,
  userId,
}: {
  accounts: Account[]
  userId: string
}) {
  const updateMutation = useUpdateAccount()
  const investments = accounts.filter((a) => a.type === 'investment')

  // Check if today is 1st of month and popup not yet shown this month
  const storageKey = `investment_popup_${userId}_${new Date().toISOString().slice(0, 7)}`
  const isFirstOfMonth = new Date().getDate() === 1
  const alreadySeen = typeof window !== 'undefined' && localStorage.getItem(storageKey) === '1'
  const shouldShow = isFirstOfMonth && !alreadySeen && investments.length > 0

  const [visible, setVisible] = useState(shouldShow)
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(investments.map((a) => [a.id, formatBalanceInput(String(Math.round(a.balance)))]))
  )
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await Promise.all(
        investments.map((a) => {
          const val = parseFloat((values[a.id] ?? '0').replace(/\./g, '')) || 0
          return updateMutation.mutateAsync({ id: a.id, data: { balance: val } })
        })
      )
      if (typeof window !== 'undefined') localStorage.setItem(storageKey, '1')
      setVisible(false)
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    if (typeof window !== 'undefined') localStorage.setItem(storageKey, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleSkip}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: C.surface, borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 }}>
          <Text style={{ fontSize: 24, textAlign: 'center', marginBottom: 8 }}>📈</Text>
          <Text style={{ fontSize: 18, fontWeight: '900', fontFamily: 'Nunito_900Black', color: C.fg1, textAlign: 'center', marginBottom: 4 }}>
            Update Nilai Investasi
          </Text>
          <Text style={{ fontSize: 12, color: C.fg3, fontFamily: 'Nunito_500Medium', textAlign: 'center', marginBottom: 20 }}>
            Awal bulan baru — masukkan nilai portofolio terkini
          </Text>

          <View style={{ gap: 14, marginBottom: 20 }}>
            {investments.map((a) => (
              <View key={a.id}>
                <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: C.fg2, marginBottom: 6 }}>
                  {a.name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.creamSunken, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14 }}>
                  <Text style={{ color: C.fg3, fontSize: 13, marginRight: 6 }}>Rp</Text>
                  <TextInput
                    style={{ flex: 1, paddingVertical: 12, fontSize: 15, color: C.fg1, fontFamily: 'Nunito_700Bold' }}
                    keyboardType="numeric"
                    value={values[a.id] ?? '0'}
                    onChangeText={(t) => setValues((v) => ({ ...v, [a.id]: formatBalanceInput(t) }))}
                  />
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{ backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 }}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, fontFamily: 'Nunito_800ExtraBold' }}>Simpan →</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSkip} style={{ alignItems: 'center', paddingVertical: 6 }}>
            <Text style={{ fontSize: 12, color: C.fg3, fontFamily: 'Nunito_500Medium' }}>Ingatkan bulan depan</Text>
          </TouchableOpacity>
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

  // Group by type
  const grouped = {
    bank: (accounts ?? []).filter((a) => a.type === 'bank'),
    credit: (accounts ?? []).filter((a) => a.type === 'credit'),
    investment: (accounts ?? []).filter((a) => a.type === 'investment'),
  }

  const totalSavings = grouped.bank.reduce((s, a) => s + a.balance, 0)
  const totalInvestment = grouped.investment.reduce((s, a) => s + a.balance, 0)

  const handleEdit = (acc: Account) => { setEditAccount(acc); setShowForm(true) }
  const handleCloseForm = () => { setShowForm(false); setEditAccount(null) }
  const handleDelete = async (acc: Account) => {
    await deleteMutation.mutateAsync(acc.id)
    setConfirmDelete(null)
  }

  // Get userId for investment popup key
  const userId = useAuthStore((s) => s.user?.id) ?? ''

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ backgroundColor: C.heroEnd, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, alignSelf: 'flex-start' }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ fontSize: 22, color: 'rgba(255,255,255,0.8)', lineHeight: 26 }}>‹</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'Nunito_600SemiBold', marginLeft: 2 }}>Kembali</Text>
          </TouchableOpacity>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 2, fontFamily: 'Nunito_500Medium' }}>Total Tabungan</Text>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900', fontFamily: 'Nunito_900Black' }}>
            {formatCurrency(totalSavings)}
          </Text>
          {totalInvestment > 0 && (
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4, fontFamily: 'Nunito_500Medium' }}>
              Investasi: {formatCurrency(totalInvestment)}
            </Text>
          )}
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: -16, paddingBottom: 32 }}>
          {/* Add button */}
          <TouchableOpacity
            onPress={() => setShowForm(true)}
            style={{
              backgroundColor: C.surface, borderRadius: 20, padding: 16, marginBottom: 20,
              flexDirection: 'row', alignItems: 'center',
              shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
              borderWidth: 1, borderColor: C.border,
            }}
          >
            <View style={{ width: 40, height: 40, backgroundColor: C.primarySoft, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Text style={{ fontSize: 22, color: C.primary, lineHeight: 26 }}>+</Text>
            </View>
            <Text style={{ color: C.primary, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', fontSize: 15 }}>Tambah Rekening Baru</Text>
          </TouchableOpacity>

          {isLoading ? (
            <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
          ) : (accounts ?? []).length === 0 ? (
            <View style={{ backgroundColor: C.surface, borderRadius: 20, padding: 32, alignItems: 'center' }}>
              <Text style={{ fontSize: 40 }}>👛</Text>
              <Text style={{ color: C.fg3, marginTop: 12, fontWeight: '500', fontFamily: 'Nunito_500Medium' }}>Belum ada rekening</Text>
              <Text style={{ color: C.fg4, fontSize: 13, marginTop: 4, textAlign: 'center', fontFamily: 'Nunito_500Medium' }}>
                Tambahkan tabungan, kartu kredit, atau akun investasi
              </Text>
            </View>
          ) : (
            <>
              {/* Render each group */}
              {([
                { key: 'bank', cfg: ACCOUNT_TYPES[0], list: grouped.bank },
                { key: 'credit', cfg: ACCOUNT_TYPES[1], list: grouped.credit },
                { key: 'investment', cfg: ACCOUNT_TYPES[2], list: grouped.investment },
              ] as const).map(({ key, cfg, list }) =>
                list.length === 0 ? null : (
                  <View key={key} style={{ marginBottom: 20 }}>
                    {/* Section header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 }}>
                      <Text style={{ fontSize: 16 }}>{cfg.icon}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: C.fg2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {cfg.label}
                      </Text>
                    </View>

                    <View style={{ gap: 10 }}>
                      {list.map((acc) => (
                        <View key={acc.id} style={{
                          backgroundColor: C.surface, borderRadius: 18, padding: 16,
                          shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
                          borderWidth: 1, borderColor: C.divider,
                        }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: cfg.color + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                              <Text style={{ fontSize: 20 }}>{cfg.icon}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ color: C.fg1, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', fontSize: 15 }}>{acc.name}</Text>
                                {(acc as any).isDefault && (
                                  <View style={{ backgroundColor: C.primarySoft, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 }}>
                                    <Text style={{ color: C.primary, fontSize: 10, fontFamily: 'Nunito_600SemiBold' }}>Utama</Text>
                                  </View>
                                )}
                              </View>
                              {(acc as any).accountNumber && (
                                <Text style={{ color: C.fg4, fontSize: 11, marginTop: 2, fontFamily: 'Nunito_500Medium' }}>
                                  •••• {String((acc as any).accountNumber).slice(-4)}
                                </Text>
                              )}
                              <Text style={{ fontSize: 11, color: C.fg3, marginTop: 1, fontFamily: 'Nunito_500Medium' }}>
                                {cfg.balanceLabel}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              {acc.type === 'investment' && (
                                <Text style={{ color: C.fg1, fontWeight: '700', fontFamily: 'Nunito_700Bold', fontSize: 15 }}>
                                  {formatCurrency(acc.balance)}
                                </Text>
                              )}
                              <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
                                <TouchableOpacity
                                  onPress={() => handleEdit(acc)}
                                  style={{ width: 32, height: 32, backgroundColor: C.primarySoft, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Text style={{ fontSize: 14, color: C.primary }}>✎</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => setConfirmDelete(acc)}
                                  style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.dangerSoft }}
                                >
                                  <Text style={{ fontSize: 13, color: C.danger }}>🗑</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>
                          <View style={{ backgroundColor: acc.color, height: 3, borderRadius: 2, marginTop: 12 }} />
                        </View>
                      ))}
                    </View>
                  </View>
                )
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Investment monthly update popup */}
      {!isLoading && accounts && accounts.length > 0 && (
        <InvestmentUpdatePopup accounts={accounts} userId={userId} />
      )}

      <AccountFormModal visible={showForm} account={editAccount} onClose={handleCloseForm} />

      {/* Delete confirm */}
      <Modal visible={!!confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: C.surface, borderRadius: 20, padding: 24, width: '100%' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: C.fg1, marginBottom: 8 }}>Hapus Rekening?</Text>
            <Text style={{ color: C.fg3, fontSize: 13, marginBottom: 24, fontFamily: 'Nunito_500Medium' }}>
              Rekening <Text style={{ fontWeight: '600', fontFamily: 'Nunito_600SemiBold' }}>{confirmDelete?.name}</Text> akan dihapus.
              Transaksi tidak ikut terhapus.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setConfirmDelete(null)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: 'center' }}
              >
                <Text style={{ color: C.fg2, fontFamily: 'Nunito_500Medium' }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => confirmDelete && handleDelete(confirmDelete)}
                disabled={deleteMutation.isPending}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center', backgroundColor: C.danger }}
              >
                {deleteMutation.isPending
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text style={{ color: '#fff', fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>Hapus</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
