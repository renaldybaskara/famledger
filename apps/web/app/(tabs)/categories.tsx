import { useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '../../src/hooks/useCategories'
import type { Category, TransactionType } from '../../src/lib/api'
import { resolveIcon } from '../../src/lib/iconMap'

const C = {
  cream: '#FAF7F2', creamSunken: '#F4EEE3', surface: '#FFFFFF',
  primary: '#6B8E6B', primarySoft: '#DEE8D7', heroEnd: '#41594F',
  accent: '#C97B5C', accentSoft: '#F4DDD0',
  danger: '#C66B6B', dangerSoft: 'rgba(198,107,107,0.1)',
  mustard: '#D9A441', mustardSoft: '#FBEFD2',
  fg1: '#2D2A26', fg2: '#55504A', fg3: '#8E887F', fg4: '#A8A39B',
  border: '#E0DBD2', divider: '#ECE4D3',
}

// ─── Config ───────────────────────────────────────────────────────────────────
const CATEGORY_ICONS = [
  '🍽️','🛒','🚗','🏠','💡','🏥','💊','🎓','👕','💅',
  '🎬','🎮','🏋️','✈️','🏨','💼','📱','💻','📚','🎸',
  '🐾','🌱','⛽','🚌','💳','💰','📊','🎁','🍺','☕',
]

const COLORS = [
  '#C97B5C', '#6B8E6B', '#D9A441', '#6E97AE',
  '#C66B6B', '#7E4F94', '#41594F', '#A8624A',
]

const TX_TYPES: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income',  label: 'Pemasukan' },
  { value: 'transfer', label: 'Transfer' },
]

// ─── Form Modal ───────────────────────────────────────────────────────────────
function CategoryFormModal({
  visible, category, onClose,
}: {
  visible: boolean
  category: Category | null
  onClose: () => void
}) {
  const isEdit = !!category
  const [name, setName] = useState(category?.name ?? '')
  const [icon, setIcon] = useState(category?.icon ?? '💰')
  const [color, setColor] = useState(category?.color ?? '#6B8E6B')
  const [type, setType] = useState<TransactionType>(
    (category?.type as TransactionType) ?? 'expense'
  )
  const [error, setError] = useState('')

  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()
  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSave = async () => {
    setError('')
    if (!name.trim()) { setError('Nama kategori wajib diisi'); return }
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: category!.id, data: { name: name.trim(), icon, color } })
      } else {
        await createMutation.mutateAsync({ name: name.trim(), icon, color, type })
      }
      onClose()
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Gagal menyimpan')
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={{ padding: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <Text style={{ fontSize: 20, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: C.fg1 }}>
                  {isEdit ? 'Edit Kategori' : 'Tambah Kategori'}
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

              {/* Preview */}
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <View
                  style={{ width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8, backgroundColor: color + '25' }}
                >
                  <Text style={{ fontSize: 28 }}>{resolveIcon(icon)}</Text>
                </View>
                <Text style={{ fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: C.fg2 }}>{name || 'Nama Kategori'}</Text>
              </View>

              {/* Type (only for new category) */}
              {!isEdit && (
                <>
                  <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: C.fg2, marginBottom: 8 }}>Jenis Transaksi</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                    {TX_TYPES.map((t) => (
                      <TouchableOpacity
                        key={t.value}
                        onPress={() => setType(t.value)}
                        style={{
                          flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: 'center', borderWidth: 1,
                          backgroundColor: type === t.value ? C.primary : C.creamSunken,
                          borderColor: type === t.value ? C.primary : C.border,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: type === t.value ? '#fff' : C.fg3 }}>{t.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Name */}
              <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: C.fg2, marginBottom: 8 }}>Nama Kategori</Text>
              <TextInput
                style={{ backgroundColor: C.creamSunken, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: C.fg1, marginBottom: 16 }}
                placeholder="Contoh: Makan & Minum"
                placeholderTextColor={C.fg4}
                value={name}
                onChangeText={setName}
              />

              {/* Icon picker */}
              <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: C.fg2, marginBottom: 8 }}>Ikon</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {CATEGORY_ICONS.map((ic) => (
                  <TouchableOpacity
                    key={ic}
                    onPress={() => setIcon(ic)}
                    style={{
                      width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: icon === ic ? C.primarySoft : C.creamSunken,
                      borderWidth: icon === ic ? 2 : 0,
                      borderColor: icon === ic ? C.primary : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{resolveIcon(ic)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Color picker */}
              <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: C.fg2, marginBottom: 8 }}>Warna</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                {COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setColor(c)}
                    style={{
                      backgroundColor: c, width: 36, height: 36, borderRadius: 18,
                      borderWidth: color === c ? 3 : 0, borderColor: 'white',
                      shadowColor: '#2D2A26', shadowOpacity: 0.12, shadowRadius: 4,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {color === c && (
                      <Text style={{ color: 'white', fontSize: 13, fontWeight: '700', lineHeight: 16 }}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={handleSave}
                disabled={isPending}
                style={{ borderRadius: 14, paddingVertical: 16, alignItems: 'center', backgroundColor: isPending ? C.primary + '99' : C.primary }}
              >
                {isPending
                  ? <ActivityIndicator color="white" />
                  : <Text style={{ color: '#fff', fontWeight: '700', fontFamily: 'Nunito_700Bold', fontSize: 15 }}>
                      {isEdit ? 'Simpan Perubahan' : 'Tambah Kategori'}
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
export default function CategoriesScreen() {
  const { data: categories, isLoading } = useCategories()
  const deleteMutation = useDeleteCategory()
  const [showForm, setShowForm] = useState(false)
  const [editCat, setEditCat] = useState<Category | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null)
  const [filter, setFilter] = useState<TransactionType | 'all'>('all')

  const filtered = (categories ?? []).filter(
    (c) => filter === 'all' || c.type === filter
  )

  const grouped = {
    expense: filtered.filter((c) => c.type === 'expense'),
    income: filtered.filter((c) => c.type === 'income'),
    transfer: filtered.filter((c) => c.type === 'transfer'),
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, alignSelf: 'flex-start' }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ fontSize: 22, color: C.primary, lineHeight: 26 }}>‹</Text>
            <Text style={{ color: C.primary, fontSize: 13, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', marginLeft: 2 }}>Kembali</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: C.fg1 }}>Kategori</Text>
            <TouchableOpacity
              onPress={() => setShowForm(true)}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 }}
            >
              <Text style={{ fontSize: 16, color: '#fff', lineHeight: 20, marginRight: 4 }}>+</Text>
              <Text style={{ color: '#fff', fontWeight: '600', fontFamily: 'Nunito_600SemiBold', fontSize: 13 }}>Tambah</Text>
            </TouchableOpacity>
          </View>

          {/* Filter tabs */}
          <View style={{ flexDirection: 'row', backgroundColor: C.creamSunken, borderRadius: 14, padding: 4, marginBottom: 20 }}>
            {(['all', 'expense', 'income', 'transfer'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={[
                  { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
                  filter === f && {
                    backgroundColor: C.surface,
                    shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: filter === f ? C.primary : C.fg4 }}>
                  {f === 'all' ? 'Semua' : f === 'expense' ? 'Keluar' : f === 'income' ? 'Masuk' : 'Transfer'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isLoading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color={C.primary} />
            </View>
          ) : (
            <>
              {(['expense', 'income', 'transfer'] as const).map((type) => {
                const items = grouped[type]
                if (items.length === 0) return null
                const labels = { expense: 'Pengeluaran', income: 'Pemasukan', transfer: 'Transfer' }
                return (
                  <View key={type} style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: C.fg4, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 }}>
                      {labels[type]}
                    </Text>
                    <View style={{ backgroundColor: C.surface, borderRadius: 20, overflow: 'hidden', shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
                      {items.map((cat, idx) => (
                        <View key={cat.id}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
                            <View
                              style={{ width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: cat.color + '20' }}
                            >
                              <Text style={{ fontSize: 20 }}>{resolveIcon(cat.icon)}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: C.fg1, fontWeight: '500', fontFamily: 'Nunito_500Medium' }}>{cat.name}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <TouchableOpacity
                                onPress={() => { setEditCat(cat); setShowForm(true) }}
                                style={{ width: 32, height: 32, backgroundColor: C.primarySoft, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                              >
                                <Text style={{ fontSize: 13, color: C.primary }}>✎</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => setConfirmDelete(cat)}
                                style={{ width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.dangerSoft }}
                              >
                                <Text style={{ fontSize: 13, color: C.danger }}>🗑</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                          {idx < items.length - 1 && (
                            <View style={{ height: 1, backgroundColor: C.creamSunken, marginLeft: 64 }} />
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )
              })}

              {filtered.length === 0 && (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <Text style={{ color: C.fg4 }}>Tidak ada kategori</Text>
                </View>
              )}
            </>
          )}

          <View style={{ height: 24 }} />
        </View>
      </ScrollView>

      <CategoryFormModal
        visible={showForm}
        category={editCat}
        onClose={() => { setShowForm(false); setEditCat(null) }}
      />

      <Modal visible={!!confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: C.surface, borderRadius: 20, padding: 24, width: '100%' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: C.fg1, marginBottom: 8 }}>Hapus Kategori?</Text>
            <Text style={{ color: C.fg3, fontSize: 13, marginBottom: 24 }}>
              Kategori <Text style={{ fontWeight: '600', fontFamily: 'Nunito_600SemiBold' }}>{confirmDelete?.name}</Text> akan dihapus.
              Transaksi yang terkait tidak ikut terhapus.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setConfirmDelete(null)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: 'center' }}
              >
                <Text style={{ color: C.fg2, fontWeight: '500', fontFamily: 'Nunito_500Medium' }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (confirmDelete) {
                    await deleteMutation.mutateAsync(confirmDelete.id)
                    setConfirmDelete(null)
                  }
                }}
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
