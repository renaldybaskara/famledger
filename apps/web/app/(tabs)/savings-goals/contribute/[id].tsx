import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { useSavingsGoalDetail, useSavingsGoalActions } from '../../../src/hooks/useSavingsGoals'
import { SOURCE_TYPE_CONFIG, SourceType } from '../../../src/lib/savingsGoals'
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner'

const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

export default function ContributeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { goal, loading: goalLoading } = useSavingsGoalDetail(id)
  const { addContribution, loading: submitting } = useSavingsGoalActions()

  const [mode, setMode] = useState<'manual' | 'withdraw'>('manual')
  const [selectedSourceId, setSelectedSourceId] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  if (goalLoading || !goal) {
    return <SafeAreaView style={styles.safe}><View style={styles.loadingContainer}><LoadingSpinner /></View></SafeAreaView>
  }

  // Auto-select first source if not selected
  if (!selectedSourceId && goal.sources?.length > 0) {
    setSelectedSourceId(goal.sources[0].id)
  }

  const handleSubmit = async () => {
    if (!selectedSourceId) {
      Alert.alert('Error', 'Pilih sumber terlebih dahulu')
      return
    }
    const numAmount = parseFloat(amount.replace(/\D/g, ''))
    if (!numAmount || numAmount <= 0) {
      Alert.alert('Error', 'Jumlah harus lebih dari 0')
      return
    }

    // For withdraw, validate against current amount
    if (mode === 'withdraw' && numAmount > goal.currentAmount) {
      Alert.alert('Error', 'Jumlah withdraw melebihi saldo saat ini')
      return
    }

    try {
      await addContribution(id, {
        sourceId: selectedSourceId,
        amount: mode === 'withdraw' ? -numAmount : numAmount,
        type: mode,
        note: note.trim() || undefined,
      })
      router.back()
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Gagal menyimpan kontribusi')
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll}>
        {/* Handle bar */}
        <View style={styles.handleBarRow}>
          <View style={styles.handleBar} />
        </View>

        {/* Title */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>Tambah Kontribusi</Text>
          <Text style={styles.goalName}>{goal.name}</Text>
        </View>

        {/* Mode Toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'manual' && styles.toggleBtnActive]}
            onPress={() => setMode('manual')}
          >
            <Text style={[styles.toggleText, mode === 'manual' && styles.toggleTextActive]}>+ Tambah</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'withdraw' && styles.toggleBtnWithdraw]}
            onPress={() => setMode('withdraw')}
          >
            <Text style={[styles.toggleText, mode === 'withdraw' && styles.toggleTextWithdraw]}>− Withdraw</Text>
          </TouchableOpacity>
        </View>

        {/* Source Picker */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Kontribusi ke:</Text>
          <View style={styles.sourceChips}>
            {goal.sources?.map((source) => {
              const config = SOURCE_TYPE_CONFIG[source.sourceType as SourceType]
              const isSelected = selectedSourceId === source.id
              return (
                <TouchableOpacity
                  key={source.id}
                  style={[styles.sourceChip, isSelected && styles.sourceChipActive]}
                  onPress={() => setSelectedSourceId(source.id)}
                >
                  <Text style={styles.sourceChipIcon}>{config?.icon || '📦'}</Text>
                  <Text style={[styles.sourceChipText, isSelected && styles.sourceChipTextActive]}>
                    {config?.label || source.sourceType}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* Amount Input */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Jumlah <Text style={styles.required}>*</Text></Text>
          <View style={[styles.amountRow, { borderColor: mode === 'withdraw' ? '#C97B5C' : '#6B8E6B' }]}>
            <Text style={styles.amountPrefix}>Rp</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor="#9BA89B"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              autoFocus
            />
          </View>
          <Text style={styles.helperText}>
            Saldo saat ini: {formatRupiah(goal.currentAmount)} / {formatRupiah(goal.targetAmount)}
          </Text>
        </View>

        {/* Note */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Catatan <Text style={styles.optional}>(opsional)</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="mis. Bonus proyek, THR, dll."
            placeholderTextColor="#9BA89B"
            value={note}
            onChangeText={setNote}
          />
        </View>

        {/* Submit */}
        <View style={styles.submitSection}>
          <TouchableOpacity
            style={[styles.submitButton, mode === 'withdraw' && styles.submitButtonWithdraw]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitText}>
              {submitting ? 'Menyimpan...' : mode === 'withdraw' ? 'Tarik Dana' : 'Simpan Kontribusi'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1, padding: 24 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  handleBarRow: { alignItems: 'center', paddingBottom: 16 },
  handleBar: { width: 40, height: 4, borderRadius: 9999, backgroundColor: '#E2E8E2' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontFamily: 'Inter', fontSize: 18, fontWeight: '700', color: '#1A2E1A' },
  goalName: { fontFamily: 'Inter', fontSize: 13, fontWeight: '500', color: '#9BA89B' },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  toggleBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#F7FAF7', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8E2' },
  toggleBtnActive: { backgroundColor: '#6B8E6B', borderColor: '#6B8E6B' },
  toggleBtnWithdraw: { backgroundColor: '#C97B5C', borderColor: '#C97B5C' },
  toggleText: { fontFamily: 'Inter', fontSize: 13, fontWeight: '500', color: '#6B7B6B' },
  toggleTextActive: { color: '#FFFFFF', fontWeight: '600' },
  toggleTextWithdraw: { color: '#FFFFFF', fontWeight: '600' },
  fieldGroup: { gap: 6, marginBottom: 20 },
  label: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: '#1A2E1A' },
  required: { color: '#C97B5C' },
  optional: { color: '#9BA89B', fontWeight: '400' },
  input: { padding: 14, backgroundColor: '#F7FAF7', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8E2', fontFamily: 'Inter', fontSize: 15, color: '#1A2E1A' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, backgroundColor: '#F7FAF7', borderRadius: 12, borderWidth: 1 },
  amountPrefix: { fontFamily: 'Inter', fontSize: 15, fontWeight: '600', color: '#1A2E1A' },
  amountInput: { flex: 1, fontFamily: 'Inter', fontSize: 22, fontWeight: '700', color: '#1A2E1A', padding: 0 },
  helperText: { fontFamily: 'Inter', fontSize: 11, color: '#9BA89B' },
  sourceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sourceChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F7FAF7', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8E2' },
  sourceChipActive: { backgroundColor: '#6B8E6B', borderColor: '#6B8E6B' },
  sourceChipIcon: { fontSize: 14 },
  sourceChipText: { fontFamily: 'Inter', fontSize: 12, fontWeight: '500', color: '#6B7B6B' },
  sourceChipTextActive: { color: '#FFFFFF' },
  submitSection: { paddingTop: 8 },
  submitButton: { alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#6B8E6B', borderRadius: 14 },
  submitButtonWithdraw: { backgroundColor: '#C97B5C' },
  submitText: { fontFamily: 'Inter', fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
})
