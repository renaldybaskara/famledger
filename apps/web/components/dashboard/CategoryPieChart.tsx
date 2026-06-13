import React from 'react'
import { View, Text, Platform } from 'react-native'
import { formatCurrencyCompact, formatPercent } from '../../src/lib/format'

interface CategoryBreakdownItem {
  categoryId: string
  categoryName: string
  categoryColor: string
  categoryIcon: string
  total: number
  percentage: number
}

interface CategoryPieChartProps {
  data: CategoryBreakdownItem[]
  title?: string
}

const FALLBACK_COLORS = [
  '#C97B5C', '#6B8E6B', '#D9A441', '#6E97AE',
  '#C66B6B', '#7E4F94', '#41594F', '#A8624A',
]

export function CategoryPieChart({ data, title = 'Pengeluaran per Kategori' }: CategoryPieChartProps) {
  if (!data || data.length === 0) {
    return (
      <View className="items-center justify-center py-10">
        <Text className="text-ink-400 text-sm">Tidak ada data</Text>
      </View>
    )
  }

  if (Platform.OS === 'web') {
    return <WebPieChart data={data} title={title} />
  }

  return <NativeCategoryList data={data} title={title} />
}

function WebPieChart({ data, title }: CategoryPieChartProps) {
  const [RechartsComponents, setComponents] = React.useState<any>(null)

  React.useEffect(() => {
    import('recharts').then((rc) => {
      setComponents({
        PieChart: rc.PieChart,
        Pie: rc.Pie,
        Cell: rc.Cell,
        Tooltip: rc.Tooltip,
        ResponsiveContainer: rc.ResponsiveContainer,
        Legend: rc.Legend,
      })
    })
  }, [])

  if (!RechartsComponents) {
    return (
      <View className="items-center justify-center h-48">
        <Text className="text-ink-400 text-sm">Memuat grafik...</Text>
      </View>
    )
  }

  const { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } = RechartsComponents

  const chartData = data.map((item, idx) => ({
    name: item.categoryName,
    value: item.total,
    color: item.categoryColor || FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
    percentage: item.percentage,
  }))

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0]
      return (
        <div
          style={{
            background: 'white',
            border: '1px solid #E0DBD2',
            borderRadius: 12,
            padding: '8px 12px',
            boxShadow: '0 4px 6px -1px rgba(45,42,38,0.08)',
          }}
        >
          <div style={{ fontWeight: 600, color: '#2D2A26', marginBottom: 2 }}>
            {item.name}
          </div>
          <div style={{ color: item.payload.color, fontFamily: 'monospace', fontSize: 14 }}>
            {formatCurrencyCompact(item.value)}
          </div>
          <div style={{ color: '#A8A39B', fontSize: 12 }}>
            {formatPercent(item.payload.percentage)}
          </div>
        </div>
      )
    }
    return null
  }

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }: any) => {
    if (percentage < 8) return null
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
      >
        {Math.round(percentage)}%
      </text>
    )
  }

  return (
    <View style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius={100}
            innerRadius={55}
            dataKey="value"
            labelLine={false}
            label={renderCustomLabel}
          >
            {chartData.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => (
              <span style={{ color: '#55504A', fontSize: 12 }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </View>
  )
}

function NativeCategoryList({ data, title }: CategoryPieChartProps) {
  return (
    <View>
      {data.map((item, idx) => (
        <View key={item.categoryId} className="flex-row items-center mb-3">
          <View
            className="w-3 h-3 rounded-full mr-3"
            style={{ backgroundColor: item.categoryColor || FALLBACK_COLORS[idx % FALLBACK_COLORS.length] }}
          />
          <Text className="flex-1 text-ink-700 text-sm">{item.categoryName}</Text>
          <Text className="text-ink-500 text-xs mr-2">{formatPercent(item.percentage)}</Text>
          <Text className="text-ink-800 text-sm font-medium font-mono">
            {formatCurrencyCompact(item.total)}
          </Text>
        </View>
      ))}
    </View>
  )
}
