import { useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useSavingsGoals, useSavingsGoalSummary } from '../../src/hooks/useSavingsGoals'
import { SOURCE_TYPE_CONFIG, SourceType, SavingsGoal } from '../../src/lib/savingsGoals'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'

const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

const formatRupiahCompact = (amount: number): string => {
  if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`
  if (amount >= 1_000_000) return `Rp ${Math.round(amount / 1_000_000)}jt`
  if (amount >= 1_000) return `Rp ${Math.round(amount / 1_000)}rb`
  return `Rp ${amount}`
}

function GoalCard({ goal }: { goal: SavingsGoal }) {
  const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0
  const isOnTrack = progress >= 50
  const progressColor = isOnTrack ? '#6B8E6B' : '#C97B5C'
  const statusLabel = progress >= 80 ? 'Hampir!' : isOnTrack ? 'On Track' : 'Behind'
  const statusColor = progress >= 80 ? '#4A8B4A' : isOnTrack ? '#4A8B4A' : '#D4943C'

  return (
    <TouchableOpacity
      style={styles.goalCard}
      onPress={() => router.push(`/(tabs)/savings-goals/${goal.id}` as any)}
    >
      <View style={styles.goalHeader}>
        <View style={[styles.goalIconBox, { backgroundColor: goal.color + '20' }]}>
          <Text style={styles.goalIconText}>{goal.icon}</Text>
        </View>
        <View style={styles.goalInfo}>
          <Text style={styles.goalName}>{goal.name}</Text>
          <Text style={styles.goalSub}>
            {goal.sources?.[0]?.sourceName || 'Tanpa rekening'} · {goal.deadline ? new Date(goal.deadline).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }) : 'Tanpa deadline'}
          </Text>
        </View>
        <Text style={[styles.goalPercent, { color: progressColor }]}>{Math.round(progress)}%</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressBar, { width: `${Math.min(progress, 100)}%`, backgroundColor: progressColor }]} />
      </View>

      <View style={styles.goalFooter}>
        <Text style={styles.goalAmountText}>{formatRupiahCompact(goal.currentAmount)} / {formatRupiahCompact(goal.targetAmount)}</Text>
        <View style={styles.statusBadge}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Source icons */}
      {goal.sources && goal.sources.length > 0 && (
        <View style={styles.sourceRow}>
          {goal.sources.map((s) => (
            <Text key={s.id} style={styles.sourceIcon}>
              {SOURCE_TYPE_CONFIG[s.sourceType as SourceType]?.icon || '📦'}
            </Text>
          ))}
        </View>
      )}
    </TouchableOpacity>
  )
}

export default function SavingsGoalsScreen() {
  const [filter, setFilter] = useState<string>('active')
  const { goals, loading, refetch } = useSavingsGoals(filter)
  const { summary } = useSavingsGoalSummary()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const activeGoals = goals.filter(g => g.status === 'active')
  const achievedGoals = goals.filter(g => g.status === 'achieved')

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Target Tabungan</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/(tabs)/savings-goals/create' as any)}
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Summary Card */}
        {summary && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>TOTAL TERKUMPUL</Text>
              <Text style={styles.summaryLabel}>{summary.totalGoals} goals aktif</Text>
            </View>
            <Text style={styles.summaryAmount}>{formatRupiah(summary.totalCurrent)}</Text>
            <View style={styles.summaryProgressTrack}>
              <View style={[styles.summaryProgressBar, { width: `${Math.min(summary.overallPercent, 100)}%` }]} />
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summarySubtext}>{Math.round(summary.overallPercent)}% dari total target</Text>
              <Text style={styles.summaryTarget}>{formatRupiahCompact(summary.totalTarget)}</Text>
            </View>
          </View>
        )}

        {/* Filter tabs */}
        <View style={styles.filterRow}>
          {['active', 'achieved', 'all'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'active' ? 'Aktif' : f === 'achieved' ? 'Tercapai' : 'Semua'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Goals list */}
        {loading ? (
          <View style={styles.loadingContainer}><LoadingSpinner /></View>
        ) : (
          <>
            {activeGoals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}

            {achievedGoals.length > 0 && filter !== 'active' && (
              <>
                <View style={styles.sectionDivider}>
                  <Text style={styles.sectionLabel}>TERCAPAI</Text>
                  <View style={styles.dividerLine} />
                </View>
                {achievedGoals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}
              </>
            )}

            {goals.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🎯</Text>
                <Text style={styles.emptyTitle}>Belum ada target</Text>
                <Text style={styles.emptySubtitle}>Buat target tabungan pertamamu!</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 20 },
  headerTitle: { fontFamily: 'Inter', fontSize: 28, fontWeight: '700', color: '#1A2E1A', letterSpacing: -0.5 },
  addButton: { width: 36, height: 36, borderRadius: 9999, backgroundColor: '#6B8E6B', alignItems: 'center', justifyContent: 'center' },
  addButtonText: { fontSize: 20, color: '#FFFFFF', fontWeight: '600', marginTop: -2 },
  summaryCard: { marginHorizontal: 24, marginBottom: 20, padding: 20, backgroundColor: '#6B8E6B', borderRadius: 16, gap: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontFamily: 'Inter', fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryAmount: { fontFamily: 'Inter', fontSize: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  summaryProgressTrack: { height: 6, borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  summaryProgressBar: { height: '100%', borderRadius: 9999, backgroundColor: '#FFFFFF' },
  summarySubtext: { fontFamily: 'Inter', fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  summaryTarget: { fontFamily: 'Inter', fontSize: 13, fontWeight: '500', color: '#FFFFFF' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginBottom: 16 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999, backgroundColor: '#F7FAF7' },
  filterTabActive: { backgroundColor: '#6B8E6B' },
  filterText: { fontFamily: 'Inter', fontSize: 13, fontWeight: '500', color: '#6B7B6B' },
  filterTextActive: { color: '#FFFFFF' },
  goalCard: { marginHorizontal: 24, marginBottom: 12, padding: 16, backgroundColor: '#F7FAF7', borderRadius: 14, gap: 12 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  goalIconText: { fontSize: 20 },
  goalInfo: { flex: 1, gap: 2 },
  goalName: { fontFamily: 'Inter', fontSize: 16, fontWeight: '600', color: '#1A2E1A' },
  goalSub: { fontFamily: 'Inter', fontSize: 13, color: '#6B7B6B' },
  goalPercent: { fontFamily: 'Inter', fontSize: 15, fontWeight: '600' },
  progressTrack: { height: 6, borderRadius: 9999, backgroundColor: '#E8F0E8', overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 9999 },
  goalFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalAmountText: { fontFamily: 'Inter', fontSize: 13, fontWeight: '500', color: '#6B7B6B' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusText: { fontFamily: 'Inter', fontSize: 12, fontWeight: '500' },
  sourceRow: { flexDirection: 'row', gap: 4 },
  sourceIcon: { fontSize: 12 },
  sectionDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, marginVertical: 12 },
  sectionLabel: { fontFamily: 'Inter', fontSize: 12, fontWeight: '600', color: '#9BA89B', letterSpacing: 0.5 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8E2' },
  loadingContainer: { paddingVertical: 40, alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontFamily: 'Inter', fontSize: 18, fontWeight: '600', color: '#1A2E1A' },
  emptySubtitle: { fontFamily: 'Inter', fontSize: 14, color: '#6B7B6B' },
})
