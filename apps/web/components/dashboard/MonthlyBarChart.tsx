import React from 'react'
import { View, Text, Platform } from 'react-native'
import { formatCurrencyCompact, formatMonth } from '../../src/lib/format'

interface MonthlyData {
  month: string
  income: number
  expense: number
}

interface MonthlyBarChartProps {
  data: MonthlyData[]
}

export function MonthlyBarChart({ data }: MonthlyBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <View className="items-center justify-center py-10">
        <Text className="text-slate-400 text-sm">Tidak ada data</Text>
      </View>
    )
  }

  if (Platform.OS === 'web') {
    return <WebBarChart data={data} />
  }

  return <NativeBarChart data={data} />
}

function WebBarChart({ data }: MonthlyBarChartProps) {
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
      <View className="items-center justify-center h-48">
        <Text className="text-slate-400 text-sm">Memuat grafik...</Text>
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
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '10px 14px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>{label}</div>
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
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="monthLabel"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => (
              <span style={{ color: '#475569', fontSize: 12 }}>
                {value === 'income' ? 'Pemasukan' : 'Pengeluaran'}
              </span>
            )}
          />
          <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} name="income" />
          <Bar dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} name="expense" />
        </BarChart>
      </ResponsiveContainer>
    </View>
  )
}

function NativeBarChart({ data }: MonthlyBarChartProps) {
  const maxValue = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1)

  return (
    <View>
      {data.map((item) => (
        <View key={item.month} className="mb-3">
          <Text className="text-slate-500 text-xs mb-1">{formatMonth(item.month)}</Text>
          <View className="flex-row gap-1">
            {/* Income bar */}
            <View className="flex-1">
              <View className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <View
                  className="h-full rounded-full bg-income"
                  style={{ width: `${(item.income / maxValue) * 100}%` }}
                />
              </View>
            </View>
            {/* Expense bar */}
            <View className="flex-1">
              <View className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <View
                  className="h-full rounded-full bg-expense"
                  style={{ width: `${(item.expense / maxValue) * 100}%` }}
                />
              </View>
            </View>
          </View>
          <View className="flex-row justify-between mt-1">
            <Text className="text-income text-xs font-mono">
              +{formatCurrencyCompact(item.income)}
            </Text>
            <Text className="text-expense text-xs font-mono">
              -{formatCurrencyCompact(item.expense)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  )
}
