import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Platform, Modal, Alert,
} from 'react-native'
import { useUpdateTransaction, useDeleteTransaction } from '../../src/hooks/useTransactions'
import { useCategories } from '../../src/hooks/useCategories'
import { resolveIcon } from '../../src/lib/iconMap'
import { useAccounts } from '../../src/hooks/useAccounts'
import { Transaction, TransactionType, Category, Account } from '../../src/lib/api'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useTheme } from '../../src/lib/theme'

function fmtIDR(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)
}

interface Props {
  transaction: Transaction | null
  visible: boolean
  onClose: () => void
  onDeleted?: () => void
}

const TYPE_LABELS: Record<string, string> = {
  income: 'Pemasukan', expense: 'Pengeluaran', transfer: 'Transfer',
}
const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income',  label: 'Pemasukan'  },
  { value: 'transfer', label: 'Transfer'  },
]

export function TransactionDetailModal({ transaction, visible, onClose, onDeleted }: Props) {
  const C = useTheme()
  const labelStyle = { fontSize: 12, fontWeight: '700' as const, color: C.fg3, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 6, fontFamily: 'Inter_700Bold' }
  const valueStyle = { fontSize: 15, fontWeight: '600' as const, color: C.fg1, fontFamily: 'Inter_600SemiBold' }
  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState({ merchant: '', note: '', amount: '', type: 'expense' as TransactionType, categoryId: '', accountId: '', date: '' })
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const updateMut = useUpdateTransaction()
  const deleteMut = useDeleteTransaction()
  const { data: categories = [] } = useCategories()
  const { data: accounts   = [] } = useAccounts()

  useEffect(() => {
    if (transaction) {
      setForm({
        merchant:   transaction.merchant  ?? '',
        note:       (transaction as any).note ?? '',
        amount:     String(transaction.amount),
        type:       transaction.type,
        categoryId: transaction.categoryId ?? transaction.category?.id ?? '',
        accountId:  transaction.accountId  ?? transaction.account?.id  ?? '',
        date:       transaction.date.split('T')[0],
      })
      setEditing(false)
      setFeedback(null)
    }
  }, [transaction])

  if (!transaction) return null

  const typeColor = form.type === 'income' ? C.income : form.type === 'transfer' ? C.transfer : C.expense
  const source    = (transaction as any).source ?? 'manual'

  const handleSave = () => {
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) {
      setFeedback({ ok: false, msg: 'Jumlah tidak valid' })
      return
    }
    updateMut.mutate(
      {
        id: transaction.id,
        data: {
          merchant:   form.merchant || undefined,
          type:       form.type,
          amount,
          categoryId: form.categoryId || undefined,
          accountId:  form.accountId  || undefined,
          date:       form.date ? new Date(form.date).toISOString() : undefined,
          ...(form.note !== undefined ? { note: form.note } : {}),
        } as any,
      },
      {
        onSuccess: () => { setFeedback({ ok: true, msg: 'Tersimpan!' }); setEditing(false); setTimeout(() => setFeedback(null), 2000) },
        onError: (e: any) => setFeedback({ ok: false, msg: e?.response?.data?.message || 'Gagal menyimpan' }),
      }
    )
  }

  const handleDelete = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (!window.confirm('Hapus transaksi ini?')) return
      deleteMut.mutate(transaction.id, {
        onSuccess: () => { onClose(); onDeleted?.() },
        onError: (e: any) => setFeedback({ ok: false, msg: e?.response?.data?.message || 'Gagal hapus' }),
      })
    } else {
      Alert.alert('Hapus Transaksi', 'Hapus transaksi ini?', [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus', style: 'destructive', onPress: () =>
            deleteMut.mutate(transaction.id, {
              onSuccess: () => { onClose(); onDeleted?.() },
              onError: (e: any) => setFeedback({ ok: false, msg: e?.response?.data?.message || 'Gagal hapus' }),
            }),
        },
      ])
    }
  }

  const content = (
    <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '90%', flex: 1, overflow: 'hidden' as const }}>
      {/* Handle bar */}
      <View style={{ alignItems: 'center', paddingTop: 12, flexShrink: 0 }}>
        <View style={{ width: 36, height: 4, borderRadius: 999, backgroundColor: C.border }} />
      </View>

      {/* Header row with close button */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, flexShrink: 0 }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: C.fg1, fontFamily: 'Inter_800ExtraBold' }}>
          Detail Transaksi
        </Text>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.creamSunken, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 16, color: C.fg2, lineHeight: 18 }}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 1, backgroundColor: C.divider, marginHorizontal: 20, marginTop: 4, marginBottom: 0, flexShrink: 0 }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={Platform.OS === 'web' ? { flex: 1, overflowY: 'auto' } as any : { flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ padding: 20 }}>

          {/* Header: amount + type */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            {editing ? (
              <TextInput
                style={{ fontSize: 32, fontWeight: '900', color: typeColor, fontFamily: 'Inter_900Black', textAlign: 'center', borderBottomWidth: 2, borderColor: typeColor, paddingVertical: 4, minWidth: 160, fontVariant: ['tabular-nums'] as any }}
                value={form.amount}
                onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))}
                keyboardType="numeric"
              />
            ) : (
              <Text style={{ fontSize: 32, fontWeight: '900', color: typeColor, fontFamily: 'Inter_900Black', fontVariant: ['tabular-nums'] as any }}>
                {form.type === 'income' ? '+' : form.type === 'expense' ? '−' : ''}{fmtIDR(transaction.amount)}
              </Text>
            )}

            {/* Type selector */}
            {editing ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                {TYPE_OPTIONS.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => setForm((f) => ({
                      ...f,
                      type: t.value,
                      // Reset category when type changes — categories are type-specific
                      categoryId: f.type !== t.value ? '' : f.categoryId,
                    }))}
                    style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: form.type === t.value ? typeColor : C.creamSunken, borderWidth: 1.5, borderColor: form.type === t.value ? typeColor : C.border }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: form.type === t.value ? '#fff' : C.fg2, fontFamily: 'Inter_700Bold' }}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={{ marginTop: 8, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, backgroundColor: typeColor + '18' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: typeColor, fontFamily: 'Inter_700Bold' }}>
                  {TYPE_LABELS[form.type]}
                </Text>
              </View>
            )}
          </View>

          {/* Source badge */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20 }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: source === 'email' ? '#DEEAF1' : C.primarySoft }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: source === 'email' ? '#4F7387' : C.heroEnd, fontFamily: 'Inter_600SemiBold' }}>
                {source === 'email' ? '📧 Dari email' : '✏️ Manual'}
              </Text>
            </View>
          </View>

          {/* Fields */}
          <View style={{ gap: 12 }}>

            {/* Merchant */}
            <DetailRow
              label="Merchant / Keterangan"
              editing={editing}
              value={form.merchant}
              displayValue={transaction.merchant || '—'}
              onChangeText={(v) => setForm((f) => ({ ...f, merchant: v }))}
              placeholder="Nama merchant atau keterangan"
            />

            {/* Date */}
            <View>
              <Text style={labelStyle}>Tanggal Transaksi</Text>
              {editing && typeof window !== 'undefined' ? (
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${C.border}`, borderRadius: 12, fontSize: 15, color: C.fg1, backgroundColor: C.creamSunken, fontFamily: 'Inter, system-ui' }}
                />
              ) : (
                <Text style={valueStyle}>
                  {format(new Date(transaction.date), 'EEEE, d MMMM yyyy HH:mm', { locale: id })}
                </Text>
              )}
            </View>

            {/* Category */}
            <View>
              <Text style={labelStyle}>Kategori</Text>
              {editing ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => setForm((f) => ({ ...f, categoryId: '' }))}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 2, backgroundColor: !form.categoryId ? C.primary : C.creamSunken, borderColor: !form.categoryId ? C.primary : C.border }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: !form.categoryId ? '#fff' : C.fg2, fontFamily: 'Inter_700Bold' }}>Tanpa Kategori</Text>
                    </TouchableOpacity>
                    {(categories as Category[])
                      // Filter categories by the currently selected transaction type.
                      // transfer shows all categories; expense/income only shows matching type.
                      .filter((c) => form.type === 'transfer' ? true : c.type === form.type)
                      .map((cat) => {
                        const active = form.categoryId === cat.id
                        return (
                          <TouchableOpacity
                            key={cat.id}
                            onPress={() => setForm((f) => ({ ...f, categoryId: cat.id }))}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 2, backgroundColor: active ? cat.color : C.creamSunken, borderColor: active ? cat.color : C.border }}
                          >
                            <Text style={{ fontSize: 16 }}>{resolveIcon(cat.icon)}</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : C.fg2, marginLeft: 6, fontFamily: 'Inter_700Bold' }}>{cat.name}</Text>
                          </TouchableOpacity>
                        )
                      })
                    }
                  </View>
                </ScrollView>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {transaction.category ? (
                    <>
                      <Text style={{ fontSize: 18 }}>{resolveIcon(transaction.category.icon)}</Text>
                      <Text style={valueStyle}>{transaction.category.name}</Text>
                    </>
                  ) : (
                    <Text style={{ ...valueStyle, color: C.fg4 }}>Belum dikategorikan</Text>
                  )}
                </View>
              )}
            </View>

            {/* Account */}
            <View>
              <Text style={labelStyle}>Rekening</Text>
              {editing ? (
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {(accounts as Account[]).map((acc) => {
                    const active = form.accountId === acc.id
                    return (
                      <TouchableOpacity
                        key={acc.id}
                        onPress={() => setForm((f) => ({ ...f, accountId: acc.id }))}
                        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 2, backgroundColor: active ? C.primary : C.creamSunken, borderColor: active ? C.primary : C.border }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : C.fg2, fontFamily: 'Inter_700Bold' }}>{acc.name}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              ) : (
                <Text style={valueStyle}>{transaction.account?.name ?? '—'}</Text>
              )}
            </View>

            {/* Note */}
            <DetailRow
              label="Catatan"
              editing={editing}
              value={form.note}
              displayValue={(transaction as any).note || '—'}
              onChangeText={(v) => setForm((f) => ({ ...f, note: v }))}
              placeholder="Tambahkan catatan..."
              multiline
            />
          </View>

          {/* Feedback */}
          {feedback && (
            <View style={{ marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: feedback.ok ? C.primarySoft : C.dangerSoft }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: feedback.ok ? C.heroEnd : C.danger, textAlign: 'center', fontFamily: 'Inter_600SemiBold' }}>
                {feedback.ok ? '✓ ' : '✕ '}{feedback.msg}
              </Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={{ marginTop: 20, gap: 10 }}>
            {editing ? (
              <>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={updateMut.isPending}
                  style={{ backgroundColor: C.primary, borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
                >
                  {updateMut.isPending
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, fontFamily: 'Inter_900Black' }}>Simpan Perubahan</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setEditing(false); setFeedback(null) }}
                  style={{ borderRadius: 16, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: C.border }}
                >
                  <Text style={{ color: C.fg2, fontWeight: '700', fontSize: 15, fontFamily: 'Inter_700Bold' }}>Batal</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => setEditing(true)}
                  style={{ backgroundColor: C.primary, borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, fontFamily: 'Inter_900Black' }}>✏️  Edit Transaksi</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDelete}
                  disabled={deleteMut.isPending}
                  style={{ backgroundColor: C.dangerSoft, borderRadius: 16, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#E08989' }}
                >
                  {deleteMut.isPending
                    ? <ActivityIndicator color={C.danger} size="small" />
                    : <Text style={{ color: C.danger, fontWeight: '800', fontSize: 15, fontFamily: 'Inter_800ExtraBold' }}>🗑  Hapus Transaksi</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={{ height: 24 }} />
        </View>
      </ScrollView>
    </View>
  )

  if (Platform.OS === 'web') {
    if (!visible) return null
    return (
      <View style={{ position: 'fixed' as any, inset: 0, zIndex: 200, backgroundColor: 'rgba(45,42,38,0.5)', justifyContent: 'flex-end', overflow: 'hidden' as any }}>
        <TouchableOpacity style={{ position: 'absolute' as any, inset: 0 }} onPress={onClose} activeOpacity={1} />
        <View style={{
          zIndex: 1,
          // Critical: cap at 92dvh so the sheet never exceeds the viewport on small screens.
          // The content View inside already has maxHeight:'90%' which resolves relative to this.
          maxHeight: '92dvh' as any,
          display: 'flex' as any, flexDirection: 'column' as any,
        }}>
          {content}
        </View>
      </View>
    )
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(45,42,38,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>{content}</TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

// ── Sub-components ─────────────────────────────────────────────
function DetailRow({ label, editing, value, displayValue, onChangeText, placeholder, multiline }: {
  label: string; editing: boolean; value: string; displayValue: string
  onChangeText: (v: string) => void; placeholder: string; multiline?: boolean
}) {
  const C = useTheme()
  const labelStyle = { fontSize: 12, fontWeight: '700' as const, color: C.fg3, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 6, fontFamily: 'Inter_700Bold' }
  const valueStyle = { fontSize: 15, fontWeight: '600' as const, color: C.fg1, fontFamily: 'Inter_600SemiBold' }
  return (
    <View>
      <Text style={labelStyle}>{label}</Text>
      {editing ? (
        <TextInput
          style={{ backgroundColor: C.creamSunken, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: C.fg1, fontFamily: 'Inter_600SemiBold', minHeight: multiline ? 80 : undefined, textAlignVertical: multiline ? 'top' : undefined }}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.fg4}
          multiline={multiline}
        />
      ) : (
        <Text style={valueStyle}>{displayValue}</Text>
      )}
    </View>
  )
}
