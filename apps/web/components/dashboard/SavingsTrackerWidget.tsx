import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useSavingsGoals } from '../../src/hooks/useSavingsGoals'
import { useSavingsGoalSummary } from '../../src/hooks/useSavingsGoals'
import { SOURCE_TYPE_CONFIG, SourceType } from '../../src/lib/savingsGoals'

const formatRupiah = (amount: number): string => {
  if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(0)}jt`
  if (amount >= 1_000) return `Rp ${(amount / 1_000).toFixed(0)}rb`
  return `Rp ${amount}`
}

export default function SavingsTrackerWidget() {
  const { summary, loading: summaryLoading } = useSavingsGoalSummary()
  const { goals, loading: goalsLoading } = useSavingsGoals('active')

  if (summaryLoading || goalsLoading) return null
  if (!summary || goals.length === 0) return null

  // Build source breakdown pills from backend summary data
  const sourcePills: { type: SourceType; amount: number }[] = []
  if (summary.totalSavingAccount > 0) sourcePills.push({ type: 'saving_account', amount: summary.totalSavingAccount })
  if (summary.totalStocks > 0) sourcePills.push({ type: 'stocks', amount: summary.totalStocks })
  if (summary.totalGold > 0) sourcePills.push({ type: 'gold', amount: summary.totalGold })
  if (summary.totalReksadana > 0) sourcePills.push({ type: 'reksadana', amount: summary.totalReksadana })
  if (summary.totalCrypto > 0) sourcePills.push({ type: 'crypto', amount: summary.totalCrypto })
  if (summary.totalDeposit > 0) sourcePills.push({ type: 'deposit', amount: summary.totalDeposit })
  if (summary.totalCash > 0) sourcePills.push({ type: 'cash', amount: summary.totalCash })
  if (summary.totalOther > 0) sourcePills.push({ type: 'other', amount: summary.totalOther })

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>🎯</Text>
          <Text style={styles.headerTitle}>Savings Tracker</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/savings-goals' as any)}>
          <Text style={styles.headerLink}>Lihat Semua</Text>
        </TouchableOpacity>
      </View>

      {/* Total Savings Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Tabungan</Text>
          <Text style={styles.summaryLabel}>{sourcePills.length} sumber aktif</Text>
        </View>
        <Text style={styles.summaryAmount}>{formatRupiah(summary.totalCurrent)}</Text>

        {/* Source Type Pills */}
        <View style={styles.pillsRow}>
          {sourcePills.map((pill) => (
            <View key={pill.type} style={styles.pill}>
              <Text style={styles.pillIcon}>{SOURCE_TYPE_CONFIG[pill.type].icon}</Text>
              <Text style={styles.pillAmount}>{formatRupiah(pill.amount)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Goal List */}
      {goals.slice(0, 3).map((goal) => {
        // Progress percentage comes from backend (currentAmount / targetAmount)
        const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0
        const isOnTrack = progress >= 50
        const progressColor = isOnTrack ? '#6B8E6B' : '#C97B5C'

        return (
          <TouchableOpacity
            key={goal.id}
            style={styles.goalRow}
            onPress={() => router.push(`/(tabs)/savings-goals/${goal.id}` as any)}
          >
            <Text style={styles.goalIcon}>{goal.icon}</Text>
            <View style={styles.goalContent}>
              <View style={styles.goalNameRow}>
                <Text style={styles.goalName}>{goal.name}</Text>
                <Text style={styles.goalAmount}>{formatRupiah(goal.currentAmount)}</Text>
              </View>
              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressBar, { width: `${Math.min(progress, 100)}%`, backgroundColor: progressColor }]} />
                </View>
                <Text style={[styles.progressText, { color: progressColor }]}>
                  {Math.round(progress)}%
                </Text>
              </View>
              {/* Source icons from backend sources data */}
              <View style={styles.sourceIcons}>
                {goal.sources?.map((source) => (
                  <Text key={source.id} style={styles.sourceIcon}>
                    {SOURCE_TYPE_CONFIG[source.sourceType as SourceType]?.icon || '📦'}
                  </Text>
                ))}
              </View>
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 16, paddingHorizontal: 24, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { fontSize: 16 },
  headerTitle: { fontFamily: 'Inter', fontSize: 16, fontWeight: '600', color: '#1A2E1A' },
  headerLink: { fontFamily: 'Inter', fontSize: 13, fontWeight: '500', color: '#6B8E6B' },
  summaryCard: { backgroundColor: '#6B8E6B', borderRadius: 14, padding: 16, gap: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontFamily: 'Inter', fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryAmount: { fontFamily: 'Inter', fontSize: 24, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4 },
  pillIcon: { fontSize: 12 },
  pillAmount: { fontFamily: 'Inter', fontSize: 11, fontWeight: '500', color: '#FFFFFF' },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  goalContent: { flex: 1, gap: 4 },
  goalNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalName: { fontFamily: 'Inter', fontSize: 14, fontWeight: '500', color: '#1A2E1A' },
  goalAmount: { fontFamily: 'Inter', fontSize: 13, fontWeight: '500', color: '#6B7B6B' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: { flex: 1, height: 5, backgroundColor: '#E8F0E8', borderRadius: 9999, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 9999 },
  progressText: { fontFamily: 'Inter', fontSize: 12, fontWeight: '500' },
  sourceIcons: { flexDirection: 'row', gap: 4 },
  sourceIcon: { fontSize: 10 },
})
