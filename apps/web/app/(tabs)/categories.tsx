import { useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react'
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '../../src/hooks/useCategories'
import type { Category, TransactionType } from '../../src/lib/api'

// ─── Config ───────────────────────────────────────────────────────────────────
const CATEGORY_ICONS = [
  '🍽️','🛒','🚗','🏠','💡','🏥','💊','🎓','👕','💅',
  '🎬','🎮','🏋️','✈️','🏨','💼','📱','💻','📚','🎸',
  '🐾','🌱','⛽','🚌','💳','💰','📊','🎁','🍺','☕',
]

const COLORS = [
  '#EF4444','#F97316','#EAB308','#22C55E','#14B8A6',
  '#3B82F6','#8B5CF6','#EC4899','#64748B','#1A2B4A',
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
  const [color, setColor] = useState(category?.color ?? '#3B82F6')
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
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-white rounded-t-3xl">
          <ScrollView keyboardShouldPersistTaps="handled">
            <View className="p-6">
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-xl font-bold text-slate-900">
                  {isEdit ? 'Edit Kategori' : 'Tambah Kategori'}
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

              {/* Preview */}
              <View className="items-center mb-6">
                <View
                  className="w-16 h-16 rounded-2xl items-center justify-center mb-2"
                  style={{ backgroundColor: color + '25' }}
                >
                  <Text style={{ fontSize: 28 }}>{icon}</Text>
                </View>
                <Text className="font-semibold text-slate-700">{name || 'Nama Kategori'}</Text>
              </View>

              {/* Type (only for new category) */}
              {!isEdit && (
                <>
                  <Text className="text-sm font-semibold text-slate-700 mb-2">Jenis Transaksi</Text>
                  <View className="flex-row gap-2 mb-4">
                    {TX_TYPES.map((t) => (
                      <TouchableOpacity
                        key={t.value}
                        onPress={() => setType(t.value)}
                        className={`flex-1 py-2.5 rounded-xl items-center border ${
                          type === t.value ? 'bg-primary border-primary' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <Text className={`text-xs font-semibold ${
                          type === t.value ? 'text-white' : 'text-slate-500'
                        }`}>{t.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Name */}
              <Text className="text-sm font-semibold text-slate-700 mb-2">Nama Kategori</Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 mb-4"
                placeholder="Contoh: Makan & Minum"
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={setName}
              />

              {/* Icon picker */}
              <Text className="text-sm font-semibold text-slate-700 mb-2">Ikon</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {CATEGORY_ICONS.map((ic) => (
                  <TouchableOpacity
                    key={ic}
                    onPress={() => setIcon(ic)}
                    className={`w-11 h-11 rounded-xl items-center justify-center ${
                      icon === ic ? 'bg-primary/10 border-2 border-primary' : 'bg-slate-50'
                    }`}
                  >
                    <Text style={{ fontSize: 20 }}>{ic}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Color picker */}
              <Text className="text-sm font-semibold text-slate-700 mb-2">Warna</Text>
              <View className="flex-row gap-2 mb-6 flex-wrap">
                {COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setColor(c)}
                    style={{
                      backgroundColor: c, width: 36, height: 36, borderRadius: 18,
                      borderWidth: color === c ? 3 : 0, borderColor: 'white',
                      shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4,
                    }}
                  >
                    {color === c && (
                      <View className="flex-1 items-center justify-center">
                        <Check size={14} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={handleSave}
                disabled={isPending}
                className={`rounded-xl py-4 items-center ${isPending ? 'bg-primary/60' : 'bg-primary'}`}
              >
                {isPending
                  ? <ActivityIndicator color="white" />
                  : <Text className="text-white font-bold text-base">
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
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-5">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-2xl font-bold text-slate-900">Kategori</Text>
            <TouchableOpacity
              onPress={() => setShowForm(true)}
              className="flex-row items-center bg-primary rounded-xl px-4 py-2.5"
            >
              <Plus size={16} color="white" />
              <Text className="text-white font-semibold text-sm ml-1.5">Tambah</Text>
            </TouchableOpacity>
          </View>

          {/* Filter tabs */}
          <View className="flex-row bg-slate-100 rounded-xl p-1 mb-5">
            {(['all', 'expense', 'income', 'transfer'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                className={`flex-1 py-2 rounded-lg items-center ${filter === f ? 'bg-white shadow-sm' : ''}`}
              >
                <Text className={`text-xs font-semibold ${filter === f ? 'text-primary' : 'text-slate-400'}`}>
                  {f === 'all' ? 'Semua' : f === 'expense' ? 'Keluar' : f === 'income' ? 'Masuk' : 'Transfer'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isLoading ? (
            <View className="py-10 items-center">
              <ActivityIndicator color="#1A2B4A" />
            </View>
          ) : (
            <>
              {(['expense', 'income', 'transfer'] as const).map((type) => {
                const items = grouped[type]
                if (items.length === 0) return null
                const labels = { expense: 'Pengeluaran', income: 'Pemasukan', transfer: 'Transfer' }
                return (
                  <View key={type} className="mb-5">
                    <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 ml-1">
                      {labels[type]}
                    </Text>
                    <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
                      {items.map((cat, idx) => (
                        <View key={cat.id}>
                          <View className="flex-row items-center px-4 py-3.5">
                            <View
                              className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                              style={{ backgroundColor: cat.color + '20' }}
                            >
                              <Text style={{ fontSize: 20 }}>{cat.icon}</Text>
                            </View>
                            <View className="flex-1">
                              <Text className="text-slate-800 font-medium">{cat.name}</Text>
                            </View>
                            <View className="flex-row gap-2">
                              <TouchableOpacity
                                onPress={() => { setEditCat(cat); setShowForm(true) }}
                                className="w-8 h-8 bg-blue-50 rounded-lg items-center justify-center"
                              >
                                <Edit2 size={13} color="#3b82f6" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => setConfirmDelete(cat)}
                                className="w-8 h-8 bg-red-50 rounded-lg items-center justify-center"
                              >
                                <Trash2 size={13} color="#ef4444" />
                              </TouchableOpacity>
                            </View>
                          </View>
                          {idx < items.length - 1 && (
                            <View className="h-px bg-slate-50 ml-16" />
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )
              })}

              {filtered.length === 0 && (
                <View className="py-10 items-center">
                  <Text className="text-slate-400">Tidak ada kategori</Text>
                </View>
              )}
            </>
          )}

          <View className="h-6" />
        </View>
      </ScrollView>

      <CategoryFormModal
        visible={showForm}
        category={editCat}
        onClose={() => { setShowForm(false); setEditCat(null) }}
      />

      {/* Delete confirm */}
      <Modal visible={!!confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(null)}>
        <View className="flex-1 bg-black/40 items-center justify-center px-6">
          <View className="bg-white rounded-2xl p-6 w-full">
            <Text className="text-lg font-bold text-slate-900 mb-2">Hapus Kategori?</Text>
            <Text className="text-slate-500 text-sm mb-6">
              Kategori <Text className="font-semibold">{confirmDelete?.name}</Text> akan dihapus.
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
                onPress={async () => {
                  if (confirmDelete) {
                    await deleteMutation.mutateAsync(confirmDelete.id)
                    setConfirmDelete(null)
                  }
                }}
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
