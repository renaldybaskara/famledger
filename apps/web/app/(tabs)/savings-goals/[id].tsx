import { useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { useSavingsGoalDetail, useSavingsGoalContributions, useSavingsGoalActions } from '../../../src/hooks/useSavingsGoals'
import { SOURCE_TYPE_CONFIG, SourceType } from '../../../src/lib/savingsGoals'
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner'

const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { goal, loading, refetch } = useSavingsGoalDetail(id)
  const { contributions } = useSavingsGoalContributions(id)
  const { updateStatus, deleteGoal } = useSavingsGoalActions()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateStatus(id, newStatus)
      refetch()
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Gagal mengubah status')
    }
  }

  const handleDelete = () => {
    Alert.alert('Hapus Target', 'Yakin ingin menghapus target ini?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        await deleteGoal(id)
        router.back()
      }},
    ])
  }

  if (loading || !goal) {
    return <SafeAreaView style={styles.safe}><View style={styles.loadingContainer}><LoadingSpinner /></View></SafeAreaView>
  }

  const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Nav Header */}
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
            <Text style={styles.navTitle}>{goal.name}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push(`/(tabs)/savings-goals/edit/${id}` as any)}>
            <Text style={styles.editLink}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Hero */}
        <View style={styles.heroSection}>
          <View style={[styles.heroIcon, { backgroundColor: goal.color + '20' }]}>
            <Text style={styles.heroIconText}>{goal.icon}</Text>
          </View>
          <Text style={styles.heroAmount}>{formatRupiah(goal.currentAmount)}</Text>
          <Text style={styles.heroSubtext}>dari {formatRupiah(goal.targetAmount)}</Text>
          <View style={styles.heroProgressTrack}>
            <View style={[styles.heroProgressBar, { width: `${Math.min(progress, 100)}%` }]} />
          </View>
          <Text style={styles.heroPercent}>{Math.round(progress)}% tercapai</Text>
        </View>

        {/* Source Breakdown */}
        {goal.sources && goal.sources.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Breakdown Sumber</Text>
              <TouchableOpacity>
                <Text style={styles.addSourceLink}>+ Tambah sumber</Text>
              </TouchableOpacity>
            </View>
            {goal.sources.map((source) => {
              const sourcePercent = goal.currentAmount > 0 ? (source.currentAmount / goal.currentAmount) * 100 : 0
              const config = SOURCE_TYPE_CONFIG[source.sourceType as SourceType]
              return (
                <View key={source.id} style={styles.sourceCard}>
                  <Text style={styles.sourceCardIcon}>{config?.icon || '📦'}</Text>
                  <View style={styles.sourceCardInfo}>
                    <View style={styles.sourceCardRow}>
                      <Text style={styles.sourceCardName}>{config?.label || source.sourceType}</Text>
                      <Text style={styles.sourceCardAmount}>{formatRupiah(source.currentAmount)}</Text>
                    </View>
                    <View style={styles.sourceCardRow}>
                      <Text style={styles.sourceCardSub}>{source.sourceName} · {source.trackingMode === 'auto' ? 'Otomatis' : 'Manual'}</Text>
                      <Text style={styles.sourceCardPercent}>{Math.round(sourcePercent)}%</Text>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push(`/(tabs)/savings-goals/contribute/${id}` as any)}
          >
            <Text style={styles.primaryButtonText}>+ Tambah Kontribusi</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        {/* Status Actions */}
        {goal.status === 'active' && (
          <View style={styles.statusRow}>
            <TouchableOpacity onPress={() => handleStatusChange('paused')}>
              <Text style={styles.statusAction}>Jeda</Text>
            </TouchableOpacity>
            <Text style={styles.statusDivider}>|</Text>
            <TouchableOpacity onPress={() => handleStatusChange('cancelled')}>
              <Text style={styles.statusAction}>Batalkan</Text>
            </TouchableOpacity>
            <Text style={styles.statusDivider}>|</Text>
            <TouchableOpacity onPress={handleDelete}>
              <Text style={[styles.statusAction, { color: '#C97B5C' }]}>Hapus</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Contribution History */}
        <View style={styles.section}>
          <View style={styles.sectionDivider}>
            <Text style={styles.sectionLabel}>RIWAYAT KONTRIBUSI</Text>
            <View style={styles.dividerLine} />
          </View>
          {contributions.map((c) => {
            const sourceConfig = SOURCE_TYPE_CONFIG[c.source?.sourceType as SourceType]
            const isWithdraw = c.type === 'withdraw' || c.amount < 0
            return (
              <View key={c.id} style={styles.historyRow}>
                <View style={styles.historyLeft}>
                  <Text style={styles.historyIcon}>{sourceConfig?.icon || '💰'}</Text>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyTitle}>
                      {sourceConfig?.label || 'Sumber'} · {c.type === 'auto' ? 'Auto' : c.type === 'manual' ? 'Manual' : 'Withdraw'}
                    </Text>
                    <Text style={styles.historySub}>
                      {new Date(c.contributedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {c.note ? ` · ${c.note}` : ''}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.historyAmount, { color: isWithdraw ? '#C97B5C' : '#4A8B4A' }]}>
                  {isWithdraw ? '−' : '+'}{formatRupiah(Math.abs(c.amount))}
                </Text>
              </View>
            )
          })}
          {contributions.length === 0 && (
            <Text style={styles.emptyHistory}>Belum ada riwayat kontribusi</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  navHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 12 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { fontSize: 24, color: '#1A2E1A', fontWeight: '300' },
  navTitle: { fontFamily: 'Inter', fontSize: 18, fontWeight: '600', color: '#1A2E1A' },
  editLink: { fontFamily: 'Inter', fontSize: 14, fontWeight: '500', color: '#6B8E6B' },
  heroSection: { alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 20 },
  heroIcon: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroIconText: { fontSize: 32 },
  heroAmount: { fontFamily: 'Inter', fontSize: 28, fontWeight: '700', color: '#1A2E1A', letterSpacing: -0.5 },
  heroSubtext: { fontFamily: 'Inter', fontSize: 14, color: '#6B7B6B' },
  heroProgressTrack: { width: '100%', height: 8, borderRadius: 9999, backgroundColor: '#E8F0E8', overflow: 'hidden' },
  heroProgressBar: { height: '100%', borderRadius: 9999, backgroundColor: '#6B8E6B' },
  heroPercent: { fontFamily: 'Inter', fontSize: 15, fontWeight: '600', color: '#6B8E6B' },
  section: { paddingHorizontal: 24, paddingBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600', color: '#1A2E1A' },
  addSourceLink: { fontFamily: 'Inter', fontSize: 12, fontWeight: '500', color: '#6B8E6B' },
  sourceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#F7FAF7', borderRadius: 12, marginBottom: 8 },
  sourceCardIcon: { fontSize: 20 },
  sourceCardInfo: { flex: 1, gap: 2 },
  sourceCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sourceCardName: { fontFamily: 'Inter', fontSize: 14, fontWeight: '500', color: '#1A2E1A' },
  sourceCardAmount: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600', color: '#1A2E1A' },
  sourceCardSub: { fontFamily: 'Inter', fontSize: 12, color: '#9BA89B' },
  sourceCardPercent: { fontFamily: 'Inter', fontSize: 12, fontWeight: '500', color: '#6B8E6B' },
  actionRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingBottom: 16 },
  primaryButton: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 14, backgroundColor: '#6B8E6B', borderRadius: 12 },
  primaryButtonText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  secondaryButton: { alignItems: 'center', justifyContent: 'center', padding: 14, backgroundColor: '#F7FAF7', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8E2' },
  secondaryButtonText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600', color: '#C97B5C' },
  statusRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingBottom: 20 },
  statusAction: { fontFamily: 'Inter', fontSize: 12, fontWeight: '500', color: '#9BA89B' },
  statusDivider: { fontFamily: 'Inter', fontSize: 12, color: '#E2E8E2' },
  sectionDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionLabel: { fontFamily: 'Inter', fontSize: 12, fontWeight: '600', color: '#9BA89B', letterSpacing: 0.5 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8E2' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8E2' },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  historyIcon: { fontSize: 14 },
  historyInfo: { flex: 1, gap: 1 },
  historyTitle: { fontFamily: 'Inter', fontSize: 13, fontWeight: '500', color: '#1A2E1A' },
  historySub: { fontFamily: 'Inter', fontSize: 11, color: '#9BA89B' },
  historyAmount: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600' },
  emptyHistory: { fontFamily: 'Inter', fontSize: 13, color: '#9BA89B', textAlign: 'center', paddingVertical: 20 },
})
