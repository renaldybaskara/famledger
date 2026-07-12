import React from 'react'
import { View, Text } from 'react-native'
import { formatCurrencyCompact } from '../../src/lib/format'
import { useTheme } from '../../src/lib/theme'

interface SummaryCardProps {
  title: string
  amount: number
  variant: 'income' | 'expense' | 'balance'
  subtitle?: string
}

export function SummaryCard({ title, amount, variant, subtitle }: SummaryCardProps) {
  const C = useTheme()

  const variantConfig = {
    income: {
      bg:          C.primarySoft,
      border:      C.isDark ? C.border : '#C8DFC0',
      titleColor:  C.income,
      amountColor: C.income,
      dotColor:    C.primary,
    },
    expense: {
      bg:          C.accentSoft,
      border:      C.isDark ? C.border : '#E8C4B0',
      titleColor:  C.expense,
      amountColor: C.expense,
      dotColor:    C.accent,
    },
    balance: {
      bg:          C.isDark ? C.surface : 'rgba(107,142,107,0.06)',
      border:      C.isDark ? C.border  : 'rgba(107,142,107,0.12)',
      titleColor:  C.primary,
      amountColor: C.primary,
      dotColor:    C.primary,
    },
  }

  const cfg = variantConfig[variant]
  const isNegative = variant === 'balance' && amount < 0

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: cfg.bg,
        borderWidth: 1,
        borderColor: cfg.border,
        borderRadius: 16,
        padding: 16,
      }}
    >
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cfg.dotColor, marginRight: 8 }} />
        <Text style={{ fontSize: 11, fontWeight: '500', color: cfg.titleColor, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Inter_600SemiBold' }}>
          {title}
        </Text>
      </View>

      {/* Amount */}
      <Text
        style={{ fontSize: 18, fontWeight: '700', color: isNegative ? C.danger : cfg.amountColor, fontFamily: 'Inter_700Bold' }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {variant === 'income' && amount > 0 ? '+' : ''}
        {variant === 'expense' && amount > 0 ? '-' : ''}
        {formatCurrencyCompact(Math.abs(amount))}
      </Text>

      {/* Subtitle */}
      {subtitle && (
        <Text style={{ color: C.fg4, fontSize: 12, marginTop: 4, fontFamily: 'Inter_500Medium' }}>{subtitle}</Text>
      )}
    </View>
  )
}
