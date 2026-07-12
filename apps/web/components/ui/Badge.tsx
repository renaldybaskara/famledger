import React from 'react'
import { View, Text } from 'react-native'
import { useTheme } from '../../src/lib/theme'

interface BadgeProps {
  label: string
  variant?: 'income' | 'expense' | 'transfer' | 'neutral'
}

export function Badge({ label, variant = 'neutral' }: BadgeProps) {
  const C = useTheme()

  const bgMap = {
    income:   C.primarySoft,
    expense:  C.accentSoft,
    transfer: C.infoSoft,
    neutral:  C.creamSunken,
  }

  const textColorMap = {
    income:   C.income,
    expense:  C.expense,
    transfer: C.isDark ? '#7AACCC' : '#2E6F8E',
    neutral:  C.fg3,
  }

  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: bgMap[variant] }}>
      <Text style={{ fontSize: 12, fontWeight: '500', color: textColorMap[variant], fontFamily: 'Inter_600SemiBold' }}>
        {label}
      </Text>
    </View>
  )
}
