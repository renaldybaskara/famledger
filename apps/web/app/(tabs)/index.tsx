import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  View, Text, ScrollView, RefreshControl,
  TouchableOpacity, Platform, Modal, Pressable, Alert,
} from 'react-native'
import { Mail, X, Zap, ChevronRight } from 'lucide-react'
import * as WebBrowser from 'expo-web-browser'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useDashboardSummary, useCategoryBreakdown, useMonthlyTrend, usePaydayTrend } from '../../src/hooks/useDashboard'
import { useTransactions } from '../../src/hooks/useTransactions'
import { useBudgets } from '../../src/hooks/useBudgets'
import { useAuthStore } from '../../src/store/auth.store'
import { useIsProActive } from '../../src/hooks/useSubscription'
import { api } from '../../src/lib/api'
import { formatCurrency, formatCurrencyCompact } from '../../src/lib/format'
import { TransactionItem } from '../../components/transactions/TransactionItem'
import { TransactionDetailModal } from '../../components/transactions/TransactionDetailModal'
import { AddTransactionModal } from '../../components/transactions/AddTransactionModal'
import { PaymentSlipScanModal } from '../../components/transactions/PaymentSlipScanModal'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { PeriodModal, getPresetRange, type Preset } from '../../components/ui/PeriodModal'

// ── Budgetin design tokens (from Paper "Polite Honey" design) ─
const C = {
  // Gradient hero: oklab(52.8% -0.078 0.035) → oklab(43.1% -0.066 0.028)
  heroStart:    '#6B8E6B',
  heroEnd:      '#41594F',
  accent:       '#C97B5C',
  accentSoft:   '#F4DDD0',
  cream:        '#FAF7F2',
  creamSunken:  '#F4EEE3',
  surface:      '#FFFFFF',
  // Chart bg from Paper: #F7FAFA
  chartBg:      '#F7FAFA',
  primary:      '#6B8E6B',
  primaryDeep:  '#3D7A56',
  expenseDeep:  '#D4704A',
  primarySoft:  '#DEE8D7',
  incomeSoft:   '#F0FAF4',   // Paper: income card bg
  expenseSoft:  '#FDF2EE',   // Paper: expense card bg
  savingSoft:   '#FBEFD2',
  fg1:          '#2D2A26',
  fg1d:         '#1A2820',
  fg2:          '#55504A',
  fg3:          '#8E887F',
  fg4:          '#9DB5A8',   // Paper: subtitle muted
  border:       '#E0DBD2',
  divider:      '#F0F4F2',   // Paper: transaction row divider
  mustard:      '#D9A441',
  // Paper active filter: #6B8E6B, inactive: #EDE8DF
  filterActive: '#6B8E6B',
  filterInactive: '#EDE8DF',
}

// ── Category progress row (Paper design) ─────────────────────
function CategoryRow({ name, amount, color, pct }: { name: string; amount: number; color: string; pct: number }) {
  return (
    <View style={{ flexDirection: 'column', gap: 4, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.fg1d, fontFamily: 'Nunito_700Bold' }}>{name}</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.expenseDeep, fontFamily: 'Nunito_700Bold', fontVariant: ['tabular-nums'] as any }}>
          {formatCurrencyCompact(amount)}
        </Text>
      </View>
      <View style={{ height: 6, borderRadius: 999, backgroundColor: '#F0EAE6', overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(pct, 100)}%` as any, height: '100%', backgroundColor: color, borderRadius: 999 }} />
      </View>
    </View>
  )
}

// ── Trend bar chart (Paper design: side-by-side bars, bg #F7FAFA) ─
function TrendBarChart({ data }: { data: { label: string; income: number; expense: number }[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expense]), 1)
  const chartH = 72  // Paper chart height
  const lastIdx = data.length - 1

  // Tooltip only shows when user hovers or taps a bar
  const activeItem = hoveredIdx !== null ? data[hoveredIdx] : null

  return (
    <View>
      {/* Tooltip — only visible when a bar is hovered/tapped */}
      {activeItem ? (
        <View style={{
          backgroundColor: C.fg1d, borderRadius: 12, padding: 12, marginBottom: 14,
          flexDirection: 'row', alignItems: 'center', gap: 8,
        }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff', fontFamily: 'Nunito_800ExtraBold', marginRight: 4 }}>
            {activeItem.label}
          </Text>
          <View style={{ width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.2)' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: C.primaryDeep }} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.7)', fontFamily: 'Nunito_600SemiBold' }}>Masuk</Text>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff', fontFamily: 'Nunito_800ExtraBold', fontVariant: ['tabular-nums'] as any }}>
              {formatCurrencyCompact(activeItem.income)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: C.expenseDeep }} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.7)', fontFamily: 'Nunito_600SemiBold' }}>Keluar</Text>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff', fontFamily: 'Nunito_800ExtraBold', fontVariant: ['tabular-nums'] as any }}>
              {formatCurrencyCompact(activeItem.expense)}
            </Text>
          </View>
        </View>
      ) : (
        // Placeholder keeps layout stable so chart doesn't jump when tooltip appears
        <View style={{ height: 0, marginBottom: 14 }} />
      )}

      {/* Bars — each month: income bar overlapping expense bar (Paper style) */}
      {/* ScrollView allows horizontal scroll when few months; minWidth prevents stretch */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartH, gap: 8 }}>
        {data.map((item, idx) => {
          const isCurrent = idx === lastIdx
          const isHovered = idx === hoveredIdx
          const incH = Math.max(Math.round((item.income  / maxVal) * chartH), 3)
          const expH = Math.max(Math.round((item.expense / maxVal) * chartH), 3)
          // Current month = solid. Hovered = solid. Others = 30% opacity
          const solid = isCurrent || isHovered
          const incColor = solid ? C.primaryDeep : C.primaryDeep + '4D'
          const expColor = solid ? C.expenseDeep : C.expenseDeep + '4D'

          return (
            <TouchableOpacity
              key={item.label}
              activeOpacity={0.8}
              onPress={() => setHoveredIdx(idx === hoveredIdx ? null : idx)}
              style={[
                data.length < 3
                  ? { width: 32, flexShrink: 0 }
                  : { flex: 1 },
                { alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
              ]}
              {...(Platform.OS === 'web' ? {
                onMouseEnter: () => setHoveredIdx(idx),
                onMouseLeave: () => setHoveredIdx(null),
              } as any : {})}
            >
              <View style={{ width: '100%', alignItems: 'stretch', justifyContent: 'flex-end', height: '100%', position: 'relative' }}>
                {/* Income bar */}
                <View style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: incH, backgroundColor: incColor,
                  borderTopLeftRadius: 6, borderTopRightRadius: 6,
                }} />
                {/* Expense bar */}
                <View style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: expH, backgroundColor: expColor,
                  borderTopLeftRadius: 6, borderTopRightRadius: 6,
                }} />
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Month labels */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {data.map((item, idx) => {
          const isCurrent = idx === lastIdx
          const isHovered = idx === hoveredIdx
          return (
            <Text
              key={item.label}
              style={[
                data.length < 3 ? { width: 32, flexShrink: 0 } : { flex: 1 },
                {
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: (isCurrent || isHovered) ? '800' : '600',
                  color: isHovered ? C.fg1d : isCurrent ? C.fg1d : C.fg4,
                  fontFamily: (isCurrent || isHovered) ? 'Nunito_800ExtraBold' : 'Nunito_600SemiBold',
                }
              ]}
            >
              {item.label}
            </Text>
          )
        })}
      </View>
    </View>
  )
}

// ── Quick Insight pill (Paper: #F0FAF4 bg, Rasio Pengeluaran) ─
function QuickInsightPill({ totalIncome, totalExpense }: { totalIncome: number; totalExpense: number }) {
  if (totalIncome <= 0 || totalExpense <= 0) return null
  const ratio = Math.min(Math.round((totalExpense / totalIncome) * 100), 100)
  const isWarning  = ratio >= 80 && ratio < 100
  const isDanger   = ratio >= 100
  // Paper: normal = #F0FAF4 bg, warning = #FDF5E4, danger = #FEF0F0
  const bgColor    = isDanger ? '#FEF0F0' : isWarning ? '#FDF5E4' : '#F0FAF4'
  const barTrack   = isDanger ? '#F8DADA' : isWarning ? '#FBEFD2' : '#D4EAD8'
  const barColor   = isDanger ? '#C66B6B' : isWarning ? C.mustard : C.primaryDeep
  const badgeBg    = isDanger ? '#FEF0F0' : isWarning ? '#FDF5E4' : C.primaryDeep
  const badgeText  = isDanger ? '#C66B6B' : isWarning ? C.mustard : '#FFFFFF'
  const labelColor = isDanger ? '#C66B6B' : isWarning ? C.mustard : C.primaryDeep
  const badgeLabel = isDanger ? '⚠️ Melebihi' : isWarning ? '⚡ Hati-hati' : '🟢 Aman'

  return (
    <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
      <View style={{
        backgroundColor: bgColor, borderRadius: 14,
        paddingHorizontal: 16, paddingVertical: 10,
        flexDirection: 'row', alignItems: 'center', gap: 10,
      }}>
        {/* Left: label + bar */}
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{
              fontSize: 12, fontWeight: '700', color: labelColor,
              fontFamily: 'Nunito_700Bold', letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}>
              Rasio Pengeluaran
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: C.fg1d, fontFamily: 'Nunito_800ExtraBold' }}>
              {ratio}%
            </Text>
          </View>
          <View style={{ height: 6, borderRadius: 999, backgroundColor: barTrack, overflow: 'hidden' }}>
            <View style={{ width: `${ratio}%` as any, height: '100%', backgroundColor: barColor, borderRadius: 999 }} />
          </View>
        </View>
        {/* Right: status badge */}
        <View style={{
          backgroundColor: badgeBg, borderRadius: 20,
          paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0,
        }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: badgeText, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 0.3 }}>
            {badgeLabel}
          </Text>
        </View>
      </View>
    </View>
  )
}

// ── Category breakdown section (Paper: donut + legend + bars) ─
function CategoryBreakdownSection({
  cats, colors,
}: {
  cats: Array<{ categoryName: string; categoryColor: string; total: number; percentage: number }>
  colors: string[]
}) {
  if (cats.length === 0) return null

  // Normalize: fill in missing names and calculate percentage from totals
  // (backend doesn't always return percentage; null categoryName = uncategorized)
  const grandTotal = cats.reduce((s, c) => s + c.total, 0) || 1
  const normalized = cats.slice(0, 5).map((cat, idx) => ({
    ...cat,
    // Null/empty name from DB LEFT JOIN = transactions with no category assigned
    // Renamed to "Tanpa Kategori" — more accurate than "Lainnya"
    categoryName: cat.categoryName || 'Tanpa Kategori',
    // Always use the CAT_COLORS palette for distinct colors
    resolvedColor: colors[idx % colors.length],
    // Percentage rounded for display
    pct: Math.round((cat.total / grandTotal) * 100),
    // Exact fraction for donut arc (never round — prevents white gap from rounding error)
    fraction: cat.total / grandTotal,
  }))

  const maxTotal = normalized[0]?.total ?? 1
  const r    = 44
  const circ = 2 * Math.PI * r  // ≈276.5
  let offset = 0

  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 18, padding: 16, shadowColor: '#1A2820', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: C.fg1d, fontFamily: 'Nunito_800ExtraBold' }}>Pengeluaran per Kategori</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: C.primaryDeep, fontFamily: 'Nunito_700Bold' }}>Lihat Semua</Text>
        </TouchableOpacity>
      </View>

      {/* Donut + legend row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 16 }}>
        {/* Donut chart */}
        <View style={{ width: 120, height: 120, flexShrink: 0, position: 'relative' }}>
          {Platform.OS === 'web' ? (
            <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
              {/* Background track — fills any gap caused by rounding or <5 categories */}
              <circle cx="60" cy="60" r={r}
                fill="none" stroke="#EDE8DF" strokeWidth="18"
              />
              {/* Segments — use exact fraction to avoid white gaps */}
              {normalized.map((cat) => {
                // Use exact fraction * circ so all segments sum perfectly
                const dash = cat.fraction * circ
                const thisDash = `${dash} ${circ - dash}`
                const thisOffset = -offset
                offset += dash
                return (
                  <circle key={cat.categoryName}
                    cx="60" cy="60" r={r}
                    transform="rotate(-90 60 60)"
                    fill="none" stroke={cat.resolvedColor} strokeWidth="18"
                    strokeDasharray={thisDash}
                    strokeDashoffset={-thisOffset}
                  />
                )
              })}
            </svg>
          ) : (
            <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 18, borderColor: colors[0] }} />
          )}
          {/* Center label */}
          <View style={{ position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -30 }, { translateY: -16 }], alignItems: 'center' }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#6B7C74', fontFamily: 'Nunito_600SemiBold' }}>Total</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: C.fg1d, fontFamily: 'Nunito_800ExtraBold', fontVariant: ['tabular-nums'] as any }}>
              {formatCurrencyCompact(grandTotal)}
            </Text>
          </View>
        </View>

        {/* Legend */}
        <View style={{ flex: 1, gap: 8 }}>
          {normalized.map((cat) => (
            <View key={cat.categoryName} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: cat.resolvedColor, flexShrink: 0 }} />
              <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: '#3D4A43', fontFamily: 'Nunito_600SemiBold' }} numberOfLines={1}>
                {cat.categoryName}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.fg1d, fontFamily: 'Nunito_700Bold' }}>
                {cat.pct}%
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Progress bars per category */}
      <View style={{ gap: 0 }}>
        {normalized.map((cat) => (
          <CategoryRow
            key={cat.categoryName}
            name={cat.categoryName}
            amount={cat.total}
            color={cat.resolvedColor}
            pct={Math.round((cat.total / maxTotal) * 100)}
          />
        ))}
      </View>

      {/* Info tip if uncategorized transactions exist */}
      {normalized.some((c) => c.categoryName === 'Tanpa Kategori') && (
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/transactions')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF9EE', borderRadius: 10, padding: 10, marginTop: 8 }}
        >
          <Text style={{ fontSize: 13 }}>💡</Text>
          <Text style={{ flex: 1, fontSize: 12, color: '#8E6A1A', fontFamily: 'Nunito_600SemiBold' }}>
            Ada transaksi belum dikategorikan. Tap untuk edit kategorinya.
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ── Budget snapshot section (Paper design) ───────────────────
type BudgetStatus = 'safe' | 'warning' | 'danger'

function getBudgetStatus(spent: number, amount: number): BudgetStatus {
  if (amount <= 0) return 'safe'
  const ratio = spent / amount
  if (ratio >= 1)   return 'danger'
  if (ratio >= 0.8) return 'warning'
  return 'safe'
}

function BudgetSnapshotSection({ budgets }: { budgets: Array<{ id: string; name: string; amount: number; spent: number; category?: { name: string; color: string } }> }) {
  if (budgets.length === 0) return null

  const top3 = [...budgets]
    .filter(b => b.amount > 0)
    .sort((a, b) => (b.spent / b.amount) - (a.spent / a.amount))
    .slice(0, 3)

  if (top3.length === 0) return null

  // Paper exact status config
  const STATUS_CONFIG: Record<BudgetStatus, {
    label: string; badgeBg: string; badgeColor: string
    barColor: string; trackColor: string
  }> = {
    safe:    { label: 'AMAN',         badgeBg: '#F0FAF4', badgeColor: C.primaryDeep, barColor: C.primaryDeep, trackColor: '#D4EAD8' },
    warning: { label: 'HAMPIR HABIS', badgeBg: '#FDF0E0', badgeColor: '#D9A441',     barColor: C.mustard,     trackColor: '#F0EAE6' },
    danger:  { label: 'MELEBIHI',     badgeBg: '#FEF0F0', badgeColor: '#C66B6B',     barColor: '#C66B6B',     trackColor: '#F8DADA' },
  }

  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 18, padding: 16, shadowColor: '#1A2820', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: C.fg1d, fontFamily: 'Nunito_800ExtraBold' }}>Anggaran Bulan Ini</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/budget')}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: C.primaryDeep, fontFamily: 'Nunito_700Bold' }}>Kelola</Text>
        </TouchableOpacity>
      </View>

      {top3.map((budget, idx) => {
        const status   = getBudgetStatus(budget.spent, budget.amount)
        const cfg      = STATUS_CONFIG[status]
        const barPct   = Math.min((budget.spent / budget.amount) * 100, 100)
        const catColor = budget.category?.color ?? C.expenseDeep
        const catName  = budget.category?.name ?? budget.name

        return (
          <View key={budget.id} style={{ marginBottom: idx < top3.length - 1 ? 14 : 0 }}>
            {/* Row: icon + name | amount + badge */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {/* Category icon bg */}
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: catColor + '22', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: catColor }} />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.fg1d, fontFamily: 'Nunito_700Bold' }} numberOfLines={1}>
                  {catName}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7C74', fontFamily: 'Nunito_600SemiBold' }}>
                  {formatCurrencyCompact(budget.spent)} / {formatCurrencyCompact(budget.amount)}
                </Text>
                <View style={{ backgroundColor: cfg.badgeBg, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: cfg.badgeColor, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 0.3 }}>
                    {cfg.label}
                  </Text>
                </View>
              </View>
            </View>
            {/* Progress bar */}
            <View style={{ height: 6, borderRadius: 999, backgroundColor: cfg.trackColor, overflow: 'hidden' }}>
              <View style={{ width: `${barPct}%` as any, height: '100%', backgroundColor: cfg.barColor, borderRadius: 999 }} />
            </View>
          </View>
        )
      })}
    </View>
  )
}

// ── Lainnya bottom sheet ──────────────────────────────────────
function LainnyaSheet({ visible, onClose, onAdd, onScan }: {
  visible: boolean; onClose: () => void; onAdd: () => void; onScan: () => void
}) {
  const isPro = useIsProActive()

  const proGate = (action: () => void) => () => {
    action()
  }

  const items = [
    { label: 'Tambah\nTransaksi', bg: '#DEE8D7', action: () => { onClose(); onAdd() },
      icon: <svg width="22" height="22" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" stroke={C.primaryDeep} strokeWidth="2.5" strokeLinecap="round" /><line x1="5" y1="12" x2="19" y2="12" stroke={C.primaryDeep} strokeWidth="2.5" strokeLinecap="round" /></svg> },
    { label: 'Scan\nStruk', bg: '#DDEEF7', action: () => { onClose(); onScan() },
      icon: <svg width="22" height="22" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="18" rx="2" fill="none" stroke="#2B7A9E" strokeWidth="1.8" /><line x1="8" y1="7" x2="16" y2="7" stroke="#2B7A9E" strokeWidth="1.5" strokeLinecap="round" /><line x1="8" y1="10.5" x2="16" y2="10.5" stroke="#2B7A9E" strokeWidth="1.5" strokeLinecap="round" /><line x1="8" y1="14" x2="12" y2="14" stroke="#2B7A9E" strokeWidth="1.5" strokeLinecap="round" /></svg> },
    { label: 'Transaksi', bg: '#F4EEE3', action: () => { onClose(); router.push('/(tabs)/transactions') },
      icon: <svg width="22" height="22" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke={C.fg2} strokeWidth="1.8" /><line x1="2" y1="10" x2="22" y2="10" stroke={C.fg2} strokeWidth="1.8" strokeLinecap="round" /></svg> },
    { label: 'Budget', bg: '#FBEFD2', action: () => { onClose(); router.push('/(tabs)/budget') },
      icon: <svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" fill="none" stroke={C.mustard} strokeWidth="1.8" strokeLinecap="round" /></svg> },
    { label: 'Email\nIntegrasi', bg: '#FDF2EE', action: proGate(() => { onClose(); router.push('/(tabs)/email-integration') }),
      icon: <svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" fill="none" stroke={C.expenseDeep} strokeWidth="1.8" /><polyline points="22,6 12,13 2,6" fill="none" stroke={C.expenseDeep} strokeWidth="1.8" /></svg> },
    { label: 'Workspace', bg: '#E8E0F5', action: proGate(() => { onClose(); router.push('/(tabs)/workspace' as any) }),
      icon: <svg width="22" height="22" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="none" stroke="#7C5CBF" strokeWidth="1.8" strokeLinecap="round" /><circle cx="9" cy="7" r="4" fill="none" stroke="#7C5CBF" strokeWidth="1.8" /></svg> },
    { label: 'Rekening', bg: '#DEE8D7', action: () => { onClose(); router.push('/(tabs)/accounts' as any) },
      icon: <svg width="22" height="22" viewBox="0 0 24 24"><rect x="2" y="8" width="20" height="14" rx="2" fill="none" stroke={C.primaryDeep} strokeWidth="1.8" /><path d="M6 8V6a6 6 0 0 1 12 0v2" fill="none" stroke={C.primaryDeep} strokeWidth="1.8" strokeLinecap="round" /></svg> },
    { label: 'Kategori', bg: '#F4DDD0', action: () => { onClose(); router.push('/(tabs)/categories' as any) },
      icon: <svg width="22" height="22" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" fill="none" stroke={C.expenseDeep} strokeWidth="1.8" /><rect x="14" y="3" width="7" height="7" rx="1" fill="none" stroke={C.expenseDeep} strokeWidth="1.8" /><rect x="3" y="14" width="7" height="7" rx="1" fill="none" stroke={C.expenseDeep} strokeWidth="1.8" /><rect x="14" y="14" width="7" height="7" rx="1" fill="none" stroke={C.expenseDeep} strokeWidth="1.8" /></svg> },
    { label: 'Setelan', bg: '#EEF3F0', action: () => { onClose(); router.push('/(tabs)/settings') },
      icon: <svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke={C.fg2} strokeWidth="1.8" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke={C.fg2} strokeWidth="1.8" /></svg> },
  ]

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable onPress={e => e.stopPropagation()}>
          <View style={{ backgroundColor: C.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: 32, paddingHorizontal: 20 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 20 }} />
            <TouchableOpacity
              onPress={() => { onClose(); router.push('/(tabs)/settings') }}
              style={{ borderRadius: 18, padding: 16, marginBottom: 20, backgroundColor: C.heroEnd, ...(({ background: `linear-gradient(135deg, ${C.heroStart} 0%, ${C.heroEnd} 100%)` }) as any), flexDirection: 'row', alignItems: 'center', gap: 14 }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>⭐</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff', fontFamily: 'Nunito_800ExtraBold' }}>Paket & Pembayaran</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontFamily: 'Nunito_500Medium' }}>Upgrade untuk fitur premium</Text>
              </View>
              <ChevronRight size={18} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {items.map((item) => (
                <TouchableOpacity key={item.label} onPress={item.action} style={{ width: '30%', alignItems: 'center', gap: 8, paddingVertical: 10 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 999, backgroundColor: item.bg, alignItems: 'center', justifyContent: 'center' }}>
                    {Platform.OS === 'web' ? item.icon : null}
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.fg1d, textAlign: 'center', fontFamily: 'Nunito_700Bold', lineHeight: 15 }}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Main Dashboard ────────────────────────────────────────────
export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const queryClient = useQueryClient()
  const isPro = useIsProActive()
  const [refreshing, setRefreshing]               = useState(false)
  const [bannerDismissed, setBannerDismissed]     = useState(false)
  const [showPeriod, setShowPeriod]               = useState(false)
  const [detailTransaction, setDetailTransaction] = useState<any>(null)
  const [preset, setPreset]                       = useState<Preset>('this_month')
  const [customRange, setCustomRange]             = useState<{ start: string; end: string } | undefined>()
  const [paydayDate, setPaydayDate]               = useState(25)
  const [selectedWsIds, setSelectedWsIds]         = useState<string[]>([])
  const [addModalVisible, setAddModalVisible]     = useState(false)
  const [scanModalVisible, setScanModalVisible]   = useState(false)
  const [lainnyaVisible, setLainnyaVisible]       = useState(false)
  const [wsInitialized, setWsInitialized]         = useState(false)
  const [showWsDropdown, setShowWsDropdown]       = useState(false)
  const [showProfilePopup, setShowProfilePopup]   = useState(false)
  const [wsDropPos, setWsDropPos]                 = useState({ top: 90, left: 20 })
  const [profilePopPos, setProfilePopPos]         = useState({ top: 80, right: 20 })
  const wsNameRef    = useRef<any>(null)
  const avatarRef    = useRef<any>(null)

  const range = getPresetRange(preset, customRange, paydayDate)

  const handlePresetSelect = (p: Preset, custom?: { start: string; end: string }, payday?: number) => {
    setPreset(p)
    if (p === 'custom' && custom) setCustomRange(custom)
    if (p === 'payday' && payday)  setPaydayDate(payday)
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const { data: pendingInvites } = useQuery({
    queryKey: ['ws-my-pending-invites'],
    queryFn:  () => api.get<{ id: string; role: string; token?: string; expiresAt: string }[]>('/workspaces/invites/pending').then(r => r.data ?? []),
    refetchInterval: 10_000,
  })

  const acceptInviteMut = useMutation({
    mutationFn: (token: string) => api.post('/workspaces/invites/accept', { token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      queryClient.invalidateQueries({ queryKey: ['ws-my-pending-invites'] })
    },
  })
  const declineInviteMut = useMutation({
    mutationFn: (token: string) => api.post('/workspaces/invites/decline', { token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ws-my-pending-invites'] }),
  })

  const { data: integrations } = useQuery({
    queryKey: ['email-integrations'],
    queryFn:  () => api.get<{ id: string; isActive: boolean }[]>('/email-integrations'),
    staleTime: 0, refetchOnMount: true, refetchOnWindowFocus: true,
  })
  const hasEmailIntegration = (integrations?.data?.length ?? 0) > 0
  const showGmailBanner     = !hasEmailIntegration && !bannerDismissed

  const handleConnectGmail = async () => {
    try {
      const { data } = await api.get<{ url: string }>('/email-integrations/gmail/auth')
      if (Platform.OS === 'web') { if (typeof window !== 'undefined') window.location.href = data.url }
      else await WebBrowser.openAuthSessionAsync(data.url, 'fintrackr://')
    } catch {}
  }

  const { data: workspacesData } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get<any[]>('/workspaces').then(r => r.data ?? []),
    staleTime: 60_000,
  })
  const workspaces = workspacesData ?? []

  // Auto-select first workspace on mount
  useEffect(() => {
    if (!wsInitialized && workspaces.length > 0) {
      setSelectedWsIds([workspaces[0].id])
      setWsInitialized(true)
    }
  }, [workspaces, wsInitialized])

  const scopeParams = selectedWsIds.length > 0
    ? { workspaceIds: selectedWsIds, includePersonal: true }
    : {}

  const { data: summary, isLoading: summaryLoading } = useDashboardSummary({ startDate: range.startDate, endDate: range.endDate, ...scopeParams })
  const { data: categoryData }                        = useCategoryBreakdown({ startDate: range.startDate, endDate: range.endDate, type: 'expense', ...scopeParams })
  const { data: trendRaw }                            = useMonthlyTrend(
    preset === 'payday'
      ? (() => {
          // Show 6 payday cycles: go back 6 months from current payday start
          const d = new Date(range.startDate)
          d.setMonth(d.getMonth() - 5) // 6 cycles total including current
          const sixCyclesStart = d.toISOString().split('T')[0]
          return { startDate: sixCyclesStart, endDate: range.endDate }
        })()
      : 6
  )
  const { data: paydayTrendRaw }                      = usePaydayTrend(paydayDate, 6, scopeParams)

  const { data: recentData, isLoading: recentLoading } = useTransactions({
    limit: 5, page: 1, startDate: range.startDate, endDate: range.endDate,
  })
  const activeWsId = selectedWsIds[0] ?? null
  const { data: wsRecentData, isLoading: wsRecentLoading } = useQuery({
    queryKey: ['ws-recent-tx', activeWsId, range.startDate, range.endDate],
    queryFn:  () => api.get<any>(`/workspaces/${activeWsId}/transactions`, {
      params: { limit: 5, startDate: range.startDate, endDate: range.endDate },
    }).then(r => r.data),
    enabled: !!activeWsId,
  })
  const activeRecentTxns    = activeWsId ? (wsRecentData?.data ?? []) : (recentData?.data ?? [])
  const activeRecentLoading = activeWsId ? wsRecentLoading : recentLoading

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    await queryClient.invalidateQueries({ queryKey: ['transactions'] })
    await queryClient.invalidateQueries({ queryKey: ['budgets'] })
    setRefreshing(false)
  }, [queryClient])

  const totalIn  = summary?.totalIncome  ?? 0
  const totalOut = summary?.totalExpense ?? 0
  const balance  = summary?.netBalance   ?? 0

  const activeWsName = useMemo(() => {
    if (selectedWsIds.length === 0) return null
    const ws = workspaces.find((w: any) => w.id === selectedWsIds[0])
    return ws?.name ?? null
  }, [selectedWsIds, workspaces])

  const displayName = activeWsName ?? (user?.name ?? 'Kamu')

  // Sort so null-named (uncategorized/"Lainnya") rows go last — named categories first
  const topCats = (categoryData ?? [])
    .slice()
    .sort((a, b) => {
      const aIsNull = !a.categoryName
      const bIsNull = !b.categoryName
      if (aIsNull && !bIsNull) return 1
      if (!aIsNull && bIsNull) return -1
      return b.total - a.total
    })
    .slice(0, 5)
  const maxAmt    = topCats[0]?.total ?? 1
  const CAT_COLORS = ['#D4704A', '#3D7A56', '#6B8E6B', '#6E97AE', '#7C5CBF', '#A8A39B']
  // Last color (#A8A39B grey) naturally falls to "Lainnya" since we sort it last

  // ── Budgets for snapshot ────────────────────────────────────
  const { data: budgetsData } = useBudgets()
  const budgets = budgetsData ?? []
  // top 3 budgets sorted by ratio (spent/amount) descending
  const top3Budgets = [...budgets]
    .filter(b => b.amount > 0)
    .sort((a, b) => (b.spent / b.amount) - (a.spent / a.amount))
    .slice(0, 3)

  // ── Active workspace member count for hero subtitle ─────────
  const activeWs = workspaces.find((w: any) => w.id === selectedWsIds[0])
  const activeMemberCount: number = (activeWs as any)?.memberCount ?? (activeWs as any)?.members?.length ?? 0

  const trendData = useMemo(() => {
    if (!trendRaw || !Array.isArray(trendRaw)) return []
    return (trendRaw as { month: string; income: number; expense: number }[])
      .slice().sort((a, b) => a.month.localeCompare(b.month))
      .map(row => ({
        label:   format(new Date(row.month + '-02'), 'MMM', { locale: id }),
        income:  row.income  ?? 0,
        expense: row.expense ?? 0,
      }))
  }, [trendRaw])

  const paydayChartData = useMemo(() => {
    if (!paydayTrendRaw || !Array.isArray(paydayTrendRaw)) return []
    return (paydayTrendRaw as { label: string; income: number; expense: number }[])
      .map(row => ({
        label:   row.label,
        income:  row.income  ?? 0,
        expense: row.expense ?? 0,
      }))
  }, [paydayTrendRaw])

  const chartData = preset === 'payday' ? paydayChartData : trendData

  const momComparison = useMemo(() => {
    if (!trendRaw || !Array.isArray(trendRaw)) return { incomePct: null as number | null, expensePct: null as number | null }
    const sorted = [...(trendRaw as { month: string; income: number; expense: number }[])]
      .sort((a, b) => a.month.localeCompare(b.month))
    if (sorted.length < 2) return { incomePct: null, expensePct: null }
    const curr = sorted[sorted.length - 1]
    const prev = sorted[sorted.length - 2]
    const incPct = prev.income > 0 ? Math.round(((curr.income - prev.income) / prev.income) * 100) : null
    const expPct = prev.expense > 0 ? Math.round(((curr.expense - prev.expense) / prev.expense) * 100) : null
    return { incomePct: incPct, expensePct: expPct }
  }, [trendRaw])

  const growthBadge = useMemo(() => {
    if (!trendRaw || !Array.isArray(trendRaw)) return null
    const sorted = [...(trendRaw as { month: string; income: number; expense: number }[])]
      .sort((a, b) => a.month.localeCompare(b.month))
    if (sorted.length < 2) return null
    const curr = sorted[sorted.length - 1]
    const prev = sorted[sorted.length - 2]
    const currNet = (curr.income ?? 0) - (curr.expense ?? 0)
    const prevNet = (prev.income ?? 0) - (prev.expense ?? 0)
    if (prevNet === 0) return null
    const pct = ((currNet - prevNet) / Math.abs(prevNet)) * 100
    return { pct: Math.round(Math.abs(pct)), positive: pct >= 0 }
  }, [trendRaw])

  const hourNow = new Date().getHours()
  const greeting = hourNow < 12 ? 'Selamat Pagi' : hourNow < 17 ? 'Selamat Siang' : 'Selamat Malam'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      {/* Backdrop + floating dropdowns — outside ScrollView so they're never clipped by card overlap */}
      {(showWsDropdown || showProfilePopup) && (
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }}
          onPress={() => { setShowWsDropdown(false); setShowProfilePopup(false) }}
        />
      )}

      {/* Workspace dropdown */}
      {showWsDropdown && (
        <View style={{
          position: 'absolute', top: wsDropPos.top, left: wsDropPos.left,
          backgroundColor: '#fff', borderRadius: 14, padding: 6,
          minWidth: 180, zIndex: 100,
          shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
        }}>
          <TouchableOpacity
            onPress={() => { setSelectedWsIds([]); setShowWsDropdown(false) }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: selectedWsIds.length === 0 ? '#F0FAF4' : 'transparent' }}
          >
            {selectedWsIds.length === 0 && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.primaryDeep }} />}
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.fg1d, fontFamily: 'Nunito_700Bold' }}>Pribadi</Text>
          </TouchableOpacity>
          {workspaces.map((ws: any) => {
            const active = selectedWsIds.includes(ws.id)
            return (
              <TouchableOpacity
                key={ws.id}
                onPress={() => { setSelectedWsIds([ws.id]); setShowWsDropdown(false) }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: active ? '#F0FAF4' : 'transparent' }}
              >
                {active && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.primaryDeep }} />}
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.fg1d, fontFamily: 'Nunito_700Bold' }}>{ws.name}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      {/* Profile popup */}
      {showProfilePopup && (
        <View style={{
          position: 'absolute', top: profilePopPos.top, right: profilePopPos.right,
          width: 220, backgroundColor: '#fff', borderRadius: 16,
          shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 20,
          zIndex: 100, overflow: 'hidden',
        }}>
          <View style={{ padding: 14, backgroundColor: '#F7FAFA', borderBottomWidth: 1, borderBottomColor: C.divider }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0A830', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15, fontFamily: 'Nunito_900Black' }}>
                  {(user?.name ?? 'K').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.fg1d, fontFamily: 'Nunito_800ExtraBold' }} numberOfLines={1}>{user?.name ?? ''}</Text>
                <Text style={{ fontSize: 11, color: C.fg3, fontFamily: 'Nunito_500Medium' }} numberOfLines={1}>{user?.email ?? ''}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => { setShowProfilePopup(false); router.push('/(tabs)/settings') }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.divider }}
          >
            {Platform.OS === 'web' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={C.fg2} strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="7" r="4" stroke={C.fg2} strokeWidth="2" /></svg>}
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.fg1, fontFamily: 'Nunito_600SemiBold' }}>Profil Saya</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setShowProfilePopup(false); router.push('/(tabs)/settings?section=billing' as any) }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.divider }}
          >
            {Platform.OS === 'web' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke={C.mustard} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.fg1, fontFamily: 'Nunito_600SemiBold' }}>Paket & Pembayaran</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setShowProfilePopup(false); logout(); router.replace('/(auth)/login') }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 }}
          >
            {Platform.OS === 'web' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#C97B5C" strokeWidth="2" strokeLinecap="round" /><polyline points="16 17 21 12 16 7" stroke="#C97B5C" strokeWidth="2" strokeLinecap="round" /><line x1="21" y1="12" x2="9" y2="12" stroke="#C97B5C" strokeWidth="2" strokeLinecap="round" /></svg>}
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#C97B5C', fontFamily: 'Nunito_600SemiBold' }}>Keluar</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />}
      >
        {/* ── Hero (Paper: rounded bottom, gradient, balance centered) ── */}
        <View style={{
          paddingBottom: 28,
          borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
          overflow: 'hidden',
          ...(Platform.OS === 'web' ? { background: 'linear-gradient(160deg, #6B8E6B 0%, #41594F 100%)' } as any : { backgroundColor: C.heroEnd }),
        }}>
          {/* Top row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20 }}>
            {/* Greeting + workspace name */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', fontFamily: 'Nunito_600SemiBold', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                {greeting}
              </Text>
              <TouchableOpacity
                ref={wsNameRef}
                onPress={() => {
                  if (wsNameRef.current?.measureInWindow) {
                    wsNameRef.current.measureInWindow((_x: number, y: number, _w: number, h: number) => {
                      setWsDropPos({ top: y + h + 6, left: 20 })
                    })
                  }
                  setShowWsDropdown(v => !v)
                  setShowProfilePopup(false)
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', fontFamily: 'Nunito_800ExtraBold' }}>
                  {displayName} 👋
                </Text>
                {Platform.OS === 'web' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <polyline points="6 9 12 15 18 9" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </TouchableOpacity>
              {/* Mode indicator dot + label */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: activeWsName ? '#6BAE80' : 'rgba(255,255,255,0.4)' }} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: activeWsName ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.5)', fontFamily: 'Nunito_700Bold', letterSpacing: 0.3 }}>
                  {activeWsName
                    ? `Mode Keluarga${activeMemberCount > 0 ? ` · ${activeMemberCount} anggota` : ''}`
                    : 'Keuangan Pribadi'}
                </Text>
              </View>
            </View>

            {/* Bell + Avatar */}
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <View style={{ position: 'relative' }}>
                <View style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  {Platform.OS === 'web' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </View>
                <View style={{ position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: 4, backgroundColor: '#E8A020', borderWidth: 1.5, borderColor: C.heroEnd }} />
              </View>

              <TouchableOpacity
                ref={avatarRef}
                onPress={() => {
                  if (avatarRef.current?.measureInWindow) {
                    avatarRef.current.measureInWindow((x: number, y: number, w: number, h: number) => {
                      setProfilePopPos({ top: y + h + 6, right: 20 })
                    })
                  }
                  setShowProfilePopup(v => !v)
                  setShowWsDropdown(false)
                }}
                activeOpacity={0.85}
              >
                <View style={{
                  width: 38, height: 38, borderRadius: 19,
                  alignItems: 'center', justifyContent: 'center',
                  ...(Platform.OS === 'web'
                    ? { background: 'linear-gradient(135deg, #F0A830 0%, #E8802A 100%)' } as any
                    : { backgroundColor: '#F0A830' }),
                }}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15, fontFamily: 'Nunito_900Black' }}>
                    {(user?.name ?? 'B').charAt(0).toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Balance — centered (Paper design) */}
          <View style={{ alignItems: 'center', paddingBottom: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)', fontFamily: 'Nunito_600SemiBold' }}>
              {activeWsName ? 'Total Saldo Keluarga' : 'Saldo Bulan Ini'}
            </Text>
            <Text style={{ fontSize: 40, fontWeight: '900', color: '#fff', marginTop: 4, letterSpacing: -1.2, lineHeight: 48, fontFamily: 'Nunito_900Black', fontVariant: ['tabular-nums'] as any }}>
              {summaryLoading ? '—' : formatCurrency(balance)}
            </Text>
            {growthBadge && !summaryLoading && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginTop: 10, gap: 4 }}>
                {Platform.OS === 'web' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <polyline points={growthBadge.positive ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} stroke="#5DCEA0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>
                  {growthBadge.positive ? '+' : '-'}{growthBadge.pct}% dari bulan lalu
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Income / Expense cards (Paper: paddingTop:20, paddingInline:20, gap:12) ── */}
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 20 }}>
          {/* Income card */}
          <View style={{ flex: 1, backgroundColor: '#F0FAF4', borderRadius: 20, padding: 16, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.primaryDeep, alignItems: 'center', justifyContent: 'center' }}>
                {Platform.OS === 'web' ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points="18 15 12 9 6 15" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#5A7066', fontFamily: 'Nunito_700Bold' }}>PEMASUKAN</Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '900', color: C.fg1d, fontFamily: 'Nunito_900Black', fontVariant: ['tabular-nums'] as any, letterSpacing: -0.36 }}>
              {summaryLoading ? '—' : formatCurrencyCompact(totalIn)}
            </Text>
            {momComparison.incomePct !== null && (
              <Text style={{ fontSize: 11, fontWeight: '600', color: C.primaryDeep, fontFamily: 'Nunito_600SemiBold' }}>
                {momComparison.incomePct >= 0 ? '↑' : '↓'} {Math.abs(momComparison.incomePct)}% vs bln lalu
              </Text>
            )}
          </View>

          {/* Expense card */}
          <View style={{ flex: 1, backgroundColor: '#FDF2EE', borderRadius: 20, padding: 16, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.expenseDeep, alignItems: 'center', justifyContent: 'center' }}>
                {Platform.OS === 'web' ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points="6 9 12 15 18 9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#5A7066', fontFamily: 'Nunito_700Bold' }}>PENGELUARAN</Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '900', color: C.fg1d, fontFamily: 'Nunito_900Black', fontVariant: ['tabular-nums'] as any, letterSpacing: -0.36 }}>
              {summaryLoading ? '—' : formatCurrencyCompact(totalOut)}
            </Text>
            {momComparison.expensePct !== null && (
              <Text style={{ fontSize: 11, fontWeight: '600', color: C.expenseDeep, fontFamily: 'Nunito_600SemiBold' }}>
                {momComparison.expensePct >= 0 ? '↑' : '↓'} {Math.abs(momComparison.expensePct)}% vs bln lalu
              </Text>
            )}
          </View>
        </View>

        {/* ── Quick Insight pill ── */}
        <QuickInsightPill totalIncome={totalIn} totalExpense={totalOut} />

        {/* ── Period filter pills (Paper: paddingInline:20, bg cream #FAF7F2) ── */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, backgroundColor: C.cream }}>
          {([
            { key: 'this_month' as Preset, label: 'Bulan ini' },
            { key: 'payday'     as Preset, label: 'Periode Gajian' },
            { key: 'custom'     as Preset, label: 'Custom', isCustom: true },
          ] as Array<{ key: Preset; label: string; isCustom?: boolean }>).map(({ key, label, isCustom }) => (
            <TouchableOpacity
              key={key}
              onPress={() => key === 'custom' ? setShowPeriod(true) : handlePresetSelect(key)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
                backgroundColor: preset === key ? C.filterActive : C.filterInactive,
              }}
            >
              {isCustom && Platform.OS === 'web' && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="17" rx="2" stroke={preset === key ? '#fff' : C.fg2} strokeWidth="2" />
                  <line x1="3" y1="9" x2="21" y2="9" stroke={preset === key ? '#fff' : C.fg2} strokeWidth="2" />
                  <line x1="8" y1="2" x2="8" y2="6" stroke={preset === key ? '#fff' : C.fg2} strokeWidth="2" strokeLinecap="round" />
                  <line x1="16" y1="2" x2="16" y2="6" stroke={preset === key ? '#fff' : C.fg2} strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
              <Text style={{ fontSize: 13, fontWeight: preset === key ? '700' : '600', fontFamily: preset === key ? 'Nunito_700Bold' : 'Nunito_600SemiBold', color: preset === key ? '#fff' : C.fg2 }}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Quick Actions (Paper: justifyContent:space-around, paddingInline:16, paddingTop:20) ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 }}>
          {([
            { label: 'Tambah',    bg: '#3D7A56', shadowColor: '#3D7A5659', action: () => setAddModalVisible(true),
              icon: <svg width="24" height="24" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" /><line x1="5" y1="12" x2="19" y2="12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" /></svg> },
            { label: 'Workspace', bg: '#7C5CBF', shadowColor: '#E8A02059', action: () => { if (!isPro) { Alert.alert('Fitur Pro', 'This Feature only for Pro Member', [{ text: 'OK' }]); return; } router.push('/(tabs)/workspace' as any) },
              icon: <svg width="22" height="22" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /><circle cx="9" cy="7" r="4" fill="none" stroke="#fff" strokeWidth="1.8" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></svg> },
            { label: 'Scan Struk',bg: '#2B7A9E', shadowColor: '#5B9BD559', action: () => setScanModalVisible(true),
              icon: <svg width="22" height="22" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="18" rx="2" fill="none" stroke="#fff" strokeWidth="1.8" /><line x1="8" y1="7" x2="16" y2="7" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /><line x1="8" y1="10.5" x2="16" y2="10.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /><line x1="8" y1="14" x2="12" y2="14" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /></svg> },
            { label: 'Lainnya',   bg: '#55504A', shadowColor: '#9B6ED659', action: () => setLainnyaVisible(true),
              icon: <svg width="22" height="22" viewBox="0 0 24 24">{[6,12,18].flatMap(cx => [7,13,19].map(cy => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.2" fill="#fff" />))}</svg> },
          ] as const).map(({ icon, label, bg, shadowColor, action }) => (
            <TouchableOpacity key={label} onPress={action} style={{ alignItems: 'center', gap: 8 }}>
              <View style={{
                width: 56, height: 56, borderRadius: 18, backgroundColor: bg,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: shadowColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16, elevation: 5,
              }}>
                {Platform.OS === 'web' ? icon : null}
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.fg1d, fontFamily: 'Nunito_700Bold' }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Gmail banner ── */}
        {showGmailBanner && (
          <View style={{ marginHorizontal: 16, marginTop: 16 }}>
            <TouchableOpacity onPress={handleConnectGmail} style={{ backgroundColor: '#FBEFD2', borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#E3B25A' }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={22} color={C.mustard} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.fg1, fontFamily: 'Nunito_800ExtraBold' }}>Auto-Import Transaksi</Text>
                <Text style={{ fontSize: 12, color: C.fg2, marginTop: 2, fontFamily: 'Nunito_500Medium' }}>Hubungkan Gmail untuk import otomatis</Text>
              </View>
              <ChevronRight size={16} color={C.fg3} strokeWidth={2} />
              <TouchableOpacity onPress={() => setBannerDismissed(true)} style={{ position: 'absolute', top: 8, right: 8 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={14} color={C.fg3} strokeWidth={2.5} />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Workspace invite banners ── */}
        {(pendingInvites ?? []).map((inv) => (
          <View key={inv.id} style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#FBEFD2', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#D9A441' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FBEFD2', alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={20} color={C.mustard} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.fg1, fontFamily: 'Nunito_800ExtraBold' }}>Undangan Workspace</Text>
                <Text style={{ fontSize: 12, color: C.fg2, marginTop: 2, fontFamily: 'Nunito_500Medium' }}>Kamu diundang sebagai {inv.role}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => inv.token && acceptInviteMut.mutate(inv.token)} disabled={acceptInviteMut.isPending || !inv.token} style={{ flex: 1, backgroundColor: C.primaryDeep, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13, fontFamily: 'Nunito_800ExtraBold' }}>Terima</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => inv.token && declineInviteMut.mutate(inv.token)} disabled={declineInviteMut.isPending || !inv.token} style={{ flex: 1, backgroundColor: '#F4EEE3', borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ color: C.fg2, fontWeight: '700', fontSize: 13, fontFamily: 'Nunito_700Bold' }}>Tolak</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={{ paddingHorizontal: 16, paddingTop: 20, gap: 16 }}>

          {/* ── Tren 6 Bulan (Paper: bg #F7FAFA, borderRadius 20) ── */}
          {chartData.length > 0 && (
            <View style={{ backgroundColor: C.chartBg, borderRadius: 20, paddingHorizontal: 12, paddingTop: 16, paddingBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: C.fg1d, fontFamily: 'Nunito_800ExtraBold' }}>
                  {preset === 'payday' ? 'Tren Gajian' : 'Tren 6 Bulan'}
                </Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.primaryDeep, fontFamily: 'Nunito_700Bold' }}>Lihat Semua</Text>
                </TouchableOpacity>
              </View>
              <TrendBarChart data={chartData} />
              {/* Legend (Paper: centered, gap:16) */}
              <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: C.primaryDeep }} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#5A7066', fontFamily: 'Nunito_600SemiBold' }}>Pemasukan</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: C.expenseDeep }} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#5A7066', fontFamily: 'Nunito_600SemiBold' }}>Pengeluaran</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Pengeluaran per Kategori ── */}
          <CategoryBreakdownSection cats={topCats} colors={CAT_COLORS} />

          {/* ── Anggaran Bulan Ini (Budget Snapshot) ── */}
          <BudgetSnapshotSection budgets={budgets} />

          {/* ── Transaksi Terbaru (Paper: white card, divider #F0F4F2) ── */}
          <View style={{ backgroundColor: C.surface, borderRadius: 18, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: C.fg1d, fontFamily: 'Nunito_800ExtraBold' }}>Transaksi Terbaru</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.primaryDeep, fontFamily: 'Nunito_700Bold' }}>Semua</Text>
              </TouchableOpacity>
            </View>
            {activeRecentLoading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}><LoadingSpinner /></View>
            ) : activeRecentTxns.length > 0 ? (
              <View>
                {activeRecentTxns.map((txn: any, idx: number) => (
                  <View key={txn.id}>
                    <TransactionItem transaction={txn} onPress={() => setDetailTransaction(txn)} />
                    {idx < activeRecentTxns.length - 1 && (
                      <View style={{ height: 1, backgroundColor: C.divider }} />
                    )}
                  </View>
                ))}
                <View style={{ height: 8 }} />
              </View>
            ) : (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.fg2, fontFamily: 'Nunito_700Bold' }}>Belum ada transaksi</Text>
                <Text style={{ fontSize: 13, color: C.fg3, marginTop: 4, fontFamily: 'Nunito_500Medium' }}>Tambahkan transaksi pertamamu</Text>
              </View>
            )}
          </View>

          {summary && summary.totalExpense > 0 && summary.totalIncome > 0 && (
            <View style={{ backgroundColor: '#DEE8D7', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#C2D4B9', flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ width: 36, height: 36, backgroundColor: 'rgba(61,122,86,0.15)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                <Text style={{ fontSize: 18 }}>💡</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.heroEnd, fontFamily: 'Nunito_800ExtraBold' }}>Insight Periode Ini</Text>
                <Text style={{ fontSize: 13, fontWeight: '500', color: C.fg2, marginTop: 4, lineHeight: 20, fontFamily: 'Nunito_500Medium' }}>
                  {balance >= 0 ? `Kamu menabung ${formatCurrencyCompact(balance)}. ` : `Pengeluaran melebihi pemasukan ${formatCurrencyCompact(Math.abs(balance))}. `}
                  Rasio pengeluaran:{' '}
                  <Text style={{ fontWeight: '800', color: C.fg1, fontFamily: 'Nunito_800ExtraBold' }}>{Math.round((summary.totalExpense / summary.totalIncome) * 100)}%</Text>
                  {' '}dari pemasukan.
                </Text>
              </View>
            </View>
          )}

          <View style={{ height: 24 }} />

          {/* Feedback / Contact */}
          <TouchableOpacity
            onPress={() => {
              const subject = encodeURIComponent('Feedback Budgetin App')
              const body = encodeURIComponent('\n\n---\nVersi: v1.0.0')
              if (Platform.OS === 'web') window.open(`mailto:renaldybaskara8@gmail.com?subject=${subject}&body=${body}`, '_self')
            }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              backgroundColor: C.surface, borderRadius: 16, padding: 14,
              borderWidth: 1, borderColor: C.border,
            }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#E8F5EE', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 16 }}>💬</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.fg1, fontFamily: 'Nunito_700Bold' }}>Ada saran atau kendala?</Text>
              <Text style={{ fontSize: 11, color: C.fg3, fontFamily: 'Nunito_500Medium', marginTop: 1 }}>Kirim feedback ke kami</Text>
            </View>
            {Platform.OS === 'web' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <polyline points="9 18 15 12 9 6" stroke={C.fg4} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </TouchableOpacity>

          <View style={{ height: 24 }} />
        </View>
      </ScrollView>

      <PeriodModal visible={showPeriod} current={preset} paydayDate={paydayDate} onSelect={handlePresetSelect} onClose={() => setShowPeriod(false)} />
      <TransactionDetailModal transaction={detailTransaction} visible={detailTransaction !== null} onClose={() => setDetailTransaction(null)} onDeleted={() => setDetailTransaction(null)} />
      <AddTransactionModal visible={addModalVisible} onClose={() => setAddModalVisible(false)} />
      <PaymentSlipScanModal visible={scanModalVisible} onClose={() => setScanModalVisible(false)} />
      <LainnyaSheet visible={lainnyaVisible} onClose={() => setLainnyaVisible(false)} onAdd={() => setAddModalVisible(true)} onScan={() => setScanModalVisible(true)} />
    </SafeAreaView>
  )
}
