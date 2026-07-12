import React from 'react'
import { View, Text, Platform } from 'react-native'
import { formatCurrencyCompact, formatMonth } from '../../src/lib/format'
import { useTheme } from '../../src/lib/theme'

interface MonthlyData {
  month: string
  income: number
  expense: number
}

interface MonthlyBarChartProps {
  data: MonthlyData[]
}

export function MonthlyBarChart({ data }: MonthlyBarChartProps) {
  const C = useTheme()

  if (!data || data.length === 0) {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
        <Text style={{ color: C.fg4, fontSize: 14 }}>Tidak ada data</Text>
      </View>
    )
  }

  if (Platform.OS === 'web') {
    return <WebBarChart data={data} />
  }

  return <NativeBarChart data={data} />
}

function WebBarChart({ data }: MonthlyBarChartProps) {
  const C = useTheme()
  const [RechartsComponents, setComponents] = React.useState<any>(null)

  React.useEffect(() => {
    import('recharts').then((rc) => {
      setComponents({
        BarChart: rc.BarChart,
        Bar: rc.Bar,
        XAxis: rc.XAxis,
        YAxis: rc.YAxis,
        CartesianGrid: rc.CartesianGrid,
        Tooltip: rc.Tooltip,
        Legend: rc.Legend,
        ResponsiveContainer: rc.ResponsiveContainer,
      })
    })
  }, [])

  if (!RechartsComponents) {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', height: 192 }}>
        <Text style={{ color: C.fg4, fontSize: 14 }}>Memuat grafik...</Text>
      </View>
    )
  }

  const {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
  } = RechartsComponents

  const chartData = data.map((item) => ({
    ...item,
    monthLabel: formatMonth(item.month),
  }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: '10px 14px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ fontWeight: 600, color: C.fg1, marginBottom: 6 }}>{label}</div>
          {payload.map((entry: any) => (
            <div
              key={entry.name}
              style={{ color: entry.color, fontFamily: 'monospace', fontSize: 13, marginBottom: 2 }}
            >
              {entry.name === 'income' ? 'Pemasukan' : 'Pengeluaran'}:{' '}
              {formatCurrencyCompact(entry.value)}
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  const formatYAxis = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}jt`
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}rb`
    return `${value}`
  }

  return (
    <View style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke={C.divider} vertical={false} />
          <XAxis
            dataKey="monthLabel"
            tick={{ fontSize: 11, fill: C.fg4 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontSize: 10, fill: C.fg4 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => (
              <span style={{ color: C.fg2, fontSize: 12 }}>
                {value === 'income' ? 'Pemasukan' : 'Pengeluaran'}
              </span>
            )}
          />
          <Bar dataKey="income"  fill={C.income}  radius={[4, 4, 0, 0]} name="income" />
          <Bar dataKey="expense" fill={C.expense} radius={[4, 4, 0, 0]} name="expense" />
        </BarChart>
      </ResponsiveContainer>
    </View>
  )
}

function NativeBarChart({ data }: MonthlyBarChartProps) {
  const C = useTheme()
  const maxValue = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1)

  return (
    <View>
      {data.map((item) => (
        <View key={item.month} style={{ marginBottom: 12 }}>
          <Text style={{ color: C.fg3, fontSize: 12, marginBottom: 4 }}>{formatMonth(item.month)}</Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {/* Income bar */}
            <View style={{ flex: 1 }}>
              <View style={{ height: 8, borderRadius: 999, backgroundColor: C.creamSunken, overflow: 'hidden' }}>
                <View
                  style={{ height: '100%', borderRadius: 999, backgroundColor: C.income, width: `${(item.income / maxValue) * 100}%` }}
                />
              </View>
            </View>
            {/* Expense bar */}
            <View style={{ flex: 1 }}>
              <View style={{ height: 8, borderRadius: 999, backgroundColor: C.creamSunken, overflow: 'hidden' }}>
                <View
                  style={{ height: '100%', borderRadius: 999, backgroundColor: C.expense, width: `${(item.expense / maxValue) * 100}%` }}
                />
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ color: C.income, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
              +{formatCurrencyCompact(item.income)}
            </Text>
            <Text style={{ color: C.expense, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
              -{formatCurrencyCompact(item.expense)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  )
}
