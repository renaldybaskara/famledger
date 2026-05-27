import React from 'react'
import { View, Text } from 'react-native'
import { formatCurrencyCompact } from '../../src/lib/format'

interface SummaryCardProps {
  title: string
  amount: number
  variant: 'income' | 'expense' | 'balance'
  subtitle?: string
}

const variantConfig = {
  income: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
    titleColor: 'text-emerald-700',
    amountColor: 'text-emerald-600',
    dotColor: 'bg-emerald-500',
    iconBg: 'bg-emerald-100',
    prefix: '+',
  },
  expense: {
    bg: 'bg-red-50',
    border: 'border-red-100',
    titleColor: 'text-red-700',
    amountColor: 'text-red-600',
    dotColor: 'bg-red-500',
    iconBg: 'bg-red-100',
    prefix: '-',
  },
  balance: {
    bg: 'bg-primary/5',
    border: 'border-primary/10',
    titleColor: 'text-primary',
    amountColor: 'text-primary',
    dotColor: 'bg-primary',
    iconBg: 'bg-primary/10',
    prefix: '',
  },
}

export function SummaryCard({ title, amount, variant, subtitle }: SummaryCardProps) {
  const cfg = variantConfig[variant]
  const isNegative = variant === 'balance' && amount < 0

  return (
    <View
      className={`flex-1 ${cfg.bg} border ${cfg.border} rounded-2xl p-4`}
    >
      {/* Header row */}
      <View className="flex-row items-center mb-3">
        <View className={`w-2 h-2 rounded-full ${cfg.dotColor} mr-2`} />
        <Text className={`text-xs font-medium ${cfg.titleColor} uppercase tracking-wide`}>
          {title}
        </Text>
      </View>

      {/* Amount */}
      <Text
        className={`text-lg font-bold ${isNegative ? 'text-red-600' : cfg.amountColor} font-mono`}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {variant === 'income' && amount > 0 ? '+' : ''}
        {variant === 'expense' && amount > 0 ? '-' : ''}
        {formatCurrencyCompact(Math.abs(amount))}
      </Text>

      {/* Subtitle */}
      {subtitle && (
        <Text className="text-slate-400 text-xs mt-1">{subtitle}</Text>
      )}
    </View>
  )
}
