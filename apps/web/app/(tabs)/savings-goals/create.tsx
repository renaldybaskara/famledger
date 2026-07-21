import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useSavingsGoalActions } from '../../../src/hooks/useSavingsGoals'
import { useAccounts } from '../../../src/hooks/useAccounts'
import { SOURCE_TYPE_CONFIG, SourceType, AddSourceInput } from '../../../src/lib/savingsGoals'

export default function CreateGoalScreen() {
  const { createGoal, loading } = useSavingsGoalActions()
  const { accounts } = useAccounts()

  // Form state
  const [scope, setScope] = useState<'personal' | 'workspace'>('personal')
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [deadline, setDeadline] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('🎯')
  const [color, setColor] = useState('#6B8E6B')
  const [sources, setSources] = useState<AddSourceInput[]>([])

  // Add source
  const addSource = (type: SourceType) => {
    const config = SOURCE_TYPE_CONFIG[type]
    setSources([...sources, {
      sourceType: type,
      sourceName: config.label,
      trackingMode: config.canAuto ? 'auto' : 'manual',
    }])
  }

  const removeSource = (index: number) => {
    setSources(sources.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Nama target wajib diisi')
      return
    }
    const amount = parseFloat(targetAmount.replace(/\D/g, ''))
    if (!amount || amount < 10000) {
      Alert.alert('Error', 'Target nominal minimum Rp 10.000')
      return
    }

    try {
      await createGoal({
        name: name.trim(),
        targetAmount: amount,
        description: description.trim() || undefined,
        icon,
        color,
        deadline: deadline || undefined,
        sources: sources.length > 0 ? sources : undefined,
      })
      router.back()
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Gagal membuat target')
    }
  }

  const sourceTypes = Object.entries(SOURCE_TYPE_CONFIG) as [SourceType, typeof SOURCE_TYPE_CONFIG[SourceType]][]

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <Text style={styles.backText}>‹</Text>
            <Text style={styles.headerTitle}>Buat Target Baru</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.cancelText}>Batal</Text>
          </TouchableOpacity>
        </View>

        {/* Scope Selector */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Simpan untuk</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, scope === 'personal' && styles.toggleBtnActive]}
              onPress={() => setScope('personal')}
            >
              <Text style={styles.toggleIcon}>🧑</Text>
              <Text style={[styles.toggleText, scope === 'personal' && styles.toggleTextActive]}>Personal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, scope === 'workspace' && styles.toggleBtnActive]}
              onPress={() => setScope('workspace')}
            >
              <Text style={styles.toggleIcon}>👨‍👩‍👧</Text>
              <Text style={[styles.toggleText, scope === 'workspace' && styles.toggleTextActive]}>Keluarga</Text>
            </TouchableOpacity>
          </View>
          {scope === 'workspace' && (
            <Text style={styles.helperText}>Target workspace bisa dilihat & dikontribusi oleh semua anggota</Text>
          )}
        </View>

        {/* Icon */}
        <View style={styles.iconSection}>
          <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
            <Text style={styles.iconDisplay}>{icon}</Text>
          </View>
          <Text style={styles.iconChangeLink}>Ganti ikon & warna</Text>
        </View>

        {/* Form Fields */}
        <View style={styles.form}>
          {/* Nama */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nama target <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="mis. DP Rumah, Liburan, Dana Darurat"
              placeholderTextColor="#9BA89B"
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Target Amount */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Target nominal <Text style={styles.required}>*</Text></Text>
            <View style={styles.amountRow}>
              <Text style={styles.amountPrefix}>Rp</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor="#9BA89B"
                keyboardType="numeric"
                value={targetAmount}
                onChangeText={setTargetAmount}
              />
            </View>
            <Text style={styles.helperText}>Minimum Rp 10.000</Text>
          </View>

          {/* Deadline */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Deadline <Text style={styles.optional}>(opsional)</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9BA89B"
              value={deadline}
              onChangeText={setDeadline}
            />
          </View>

          {/* Sources */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Sumber tabungan</Text>
            {sources.map((source, i) => {
              const config = SOURCE_TYPE_CONFIG[source.sourceType as SourceType]
              return (
                <View key={i} style={styles.sourceItem}>
                  <Text style={styles.sourceItemIcon}>{config?.icon}</Text>
                  <Text style={styles.sourceItemName}>{source.sourceName}</Text>
                  <Text style={styles.sourceItemMode}>{source.trackingMode === 'auto' ? 'Otomatis' : 'Manual'}</Text>
                  <TouchableOpacity onPress={() => removeSource(i)}>
                    <Text style={styles.sourceRemove}>✕</Text>
                  </TouchableOpacity>
                </View>
              )
            })}
            <View style={styles.addSourceRow}>
              {sourceTypes.filter(([type]) => !sources.find(s => s.sourceType === type)).slice(0, 4).map(([type, config]) => (
                <TouchableOpacity key={type} style={styles.addSourceChip} onPress={() => addSource(type)}>
                  <Text style={styles.addSourceChipIcon}>{config.icon}</Text>
                  <Text style={styles.addSourceChipText}>{config.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.helperText}>Hanya rekening bank bisa otomatis. Sumber lain perlu update manual.</Text>
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Deskripsi <Text style={styles.optional}>(opsional)</Text></Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              placeholder="Tulis motivasi atau catatan..."
              placeholderTextColor="#9BA89B"
              multiline
              value={description}
              onChangeText={setDescription}
            />
          </View>
        </View>

        {/* Submit */}
        <View style={styles.submitSection}>
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
            <Text style={styles.submitText}>{loading ? 'Menyimpan...' : 'Simpan Target'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { fontSize: 24, color: '#1A2E1A', fontWeight: '300' },
  headerTitle: { fontFamily: 'Inter', fontSize: 18, fontWeight: '600', color: '#1A2E1A' },
  cancelText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '500', color: '#9BA89B' },
  iconSection: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  iconBox: { width: 72, height: 72, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  iconDisplay: { fontSize: 36 },
  iconChangeLink: { fontFamily: 'Inter', fontSize: 13, fontWeight: '500', color: '#6B8E6B' },
  form: { paddingHorizontal: 24, gap: 20 },
  fieldGroup: { gap: 6 },
  label: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: '#1A2E1A' },
  required: { color: '#C97B5C' },
  optional: { color: '#9BA89B', fontWeight: '400' },
  input: { padding: 14, backgroundColor: '#F7FAF7', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8E2', fontFamily: 'Inter', fontSize: 15, color: '#1A2E1A' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, backgroundColor: '#F7FAF7', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8E2' },
  amountPrefix: { fontFamily: 'Inter', fontSize: 15, fontWeight: '600', color: '#1A2E1A' },
  amountInput: { flex: 1, fontFamily: 'Inter', fontSize: 15, color: '#1A2E1A', padding: 0 },
  helperText: { fontFamily: 'Inter', fontSize: 11, color: '#9BA89B' },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#F7FAF7', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8E2' },
  toggleBtnActive: { backgroundColor: '#6B8E6B', borderColor: '#6B8E6B' },
  toggleIcon: { fontSize: 16 },
  toggleText: { fontFamily: 'Inter', fontSize: 13, fontWeight: '500', color: '#6B7B6B' },
  toggleTextActive: { color: '#FFFFFF', fontWeight: '600' },
  sourceItem: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#F7FAF7', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8E2' },
  sourceItemIcon: { fontSize: 16 },
  sourceItemName: { flex: 1, fontFamily: 'Inter', fontSize: 13, fontWeight: '500', color: '#1A2E1A' },
  sourceItemMode: { fontFamily: 'Inter', fontSize: 11, color: '#9BA89B' },
  sourceRemove: { fontFamily: 'Inter', fontSize: 14, color: '#C97B5C', paddingHorizontal: 4 },
  addSourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  addSourceChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#E8F0E8', borderRadius: 9999 },
  addSourceChipIcon: { fontSize: 12 },
  addSourceChipText: { fontFamily: 'Inter', fontSize: 11, fontWeight: '500', color: '#5A7A5A' },
  submitSection: { padding: 24 },
  submitButton: { alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#6B8E6B', borderRadius: 14 },
  submitText: { fontFamily: 'Inter', fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
})
