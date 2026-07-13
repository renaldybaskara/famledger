import { useMemo } from 'react'
import { View, Text, TouchableOpacity, Platform } from 'react-native'
import { router } from 'expo-router'
import { useTheme } from '../../src/lib/theme'
import { formatCurrencyCompact } from '../../src/lib/format'

interface DayData {
  date: string
  income: number
  expense: number
  count: number
}

interface MonthlyCalendarHeatmapProps {
  days: DayData[]
  year: number
  month: number // 0-indexed (JS Date style)
}

const DAY_LABELS = ['SN', 'SL', 'RB', 'KM', 'JM', 'SB', 'MG']

/**
 * Format amount for cell display — shorter than formatCurrencyCompact
 * Removes "Rp " prefix to save space in small cells.
 * Examples: -2.2JT, -66RB, -503RB
 */
function cellAmount(amount: number): string {
  const abs = Math.abs(amount)
  const sign = '-'
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1)}M`
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1)}JT`
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)}RB`
  }
  if (abs > 0) {
    return `${sign}${Math.round(abs)}`
  }
  return ''
}

/**
 * Get expense intensity tier for coloring:
 * 0 = no expense, 1 = light, 2 = medium, 3 = heavy
 */
function getIntensity(expense: number, maxExpense: number): number {
  if (expense <= 0) return 0
  if (maxExpense <= 0) return 1
  const ratio = expense / maxExpense
  if (ratio > 0.6) return 3
  if (ratio > 0.25) return 2
  return 1
}

export function MonthlyCalendarHeatmap({ days, year, month }: MonthlyCalendarHeatmapProps) {
  const C = useTheme()

  const { grid, maxExpense, monthLabel } = useMemo(() => {
    // Build a map of date→data for quick lookup
    const dayMap = new Map<string, DayData>()
    let max = 0
    for (const d of days) {
      dayMap.set(d.date, d)
      if (d.expense > max) max = d.expense
    }

    // First day of month
    const firstDay = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    // getDay() returns 0=Sunday. We want Monday=0.
    // Convert: Mon=0, Tue=1, ..., Sun=6
    let startDow = firstDay.getDay() - 1
    if (startDow < 0) startDow = 6 // Sunday

    // Build grid rows (weeks)
    const weeks: (number | null)[][] = []
    let currentWeek: (number | null)[] = []

    // Fill leading empty cells
    for (let i = 0; i < startDow; i++) {
      currentWeek.push(null)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      currentWeek.push(day)
      if (currentWeek.length === 7) {
        weeks.push(currentWeek)
        currentWeek = []
      }
    }

    // Fill trailing empty cells
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null)
      }
      weeks.push(currentWeek)
    }

    // Month label
    const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
    const label = `${monthNames[month]} ${year}`

    return { grid: weeks, maxExpense: max, monthLabel: label }
  }, [days, year, month])

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const todayDate = today.getDate()

  // Color scheme for expense intensity
  const INTENSITY_COLORS = [
    'transparent',         // 0: no expense
    C.isDark ? '#1A2E1A' : '#DEE8D7',  // 1: light (primarySoft)
    C.isDark ? '#2E2410' : '#FBEFD2',  // 2: medium (savingSoft)
    C.isDark ? '#2E1B18' : '#F4DDD0',  // 3: heavy (expenseSoft)
  ]

  const handleDayPress = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    router.push(`/(tabs)/transactions?startDate=${dateStr}&endDate=${dateStr}` as any)
  }

  return (
    <View>
      {/* Month label */}
      <Text style={{
        fontSize: 12, fontWeight: '700', color: C.primaryDeep,
        fontFamily: 'Inter_700Bold', letterSpacing: 0.5, marginBottom: 12,
      }}>
        {monthLabel}
      </Text>

      {/* Day-of-week headers */}
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {DAY_LABELS.map((label) => (
          <View key={label} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{
              fontSize: 10, fontWeight: '700', color: C.fg4,
              fontFamily: 'Inter_700Bold', letterSpacing: 0.3,
            }}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      {grid.map((week, weekIdx) => (
        <View key={weekIdx} style={{ flexDirection: 'row', marginBottom: 2 }}>
          {week.map((day, dayIdx) => {
            if (day === null) {
              return <View key={dayIdx} style={{ flex: 1, aspectRatio: 1 }} />
            }

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayData = days.find(d => d.date === dateStr)
            const expense = dayData?.expense ?? 0
            const intensity = getIntensity(expense, maxExpense)
            const isToday = isCurrentMonth && day === todayDate
            const hasExpense = expense > 0

            return (
              <TouchableOpacity
                key={dayIdx}
                onPress={() => handleDayPress(day)}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  aspectRatio: 1,
                  margin: 1,
                  borderRadius: 6,
                  backgroundColor: INTENSITY_COLORS[intensity],
                  borderWidth: isToday ? 1.5 : 0,
                  borderColor: isToday ? C.primaryDeep : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 1,
                }}
              >
                {/* Date number */}
                <Text style={{
                  fontSize: 10,
                  fontWeight: isToday ? '800' : '600',
                  color: isToday ? C.primaryDeep : C.fg2,
                  fontFamily: isToday ? 'Inter_800ExtraBold' : 'Inter_600SemiBold',
                }}>
                  {day}
                </Text>

                {/* Expense amount */}
                {hasExpense && (
                  <Text style={{
                    fontSize: 7.5,
                    fontWeight: '700',
                    color: intensity === 3 ? C.expenseDeep : intensity === 2 ? C.mustard : C.fg3,
                    fontFamily: 'Inter_700Bold',
                    marginTop: -1,
                  }} numberOfLines={1}>
                    {cellAmount(expense)}
                  </Text>
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      ))}
    </View>
  )
}
