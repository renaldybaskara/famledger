import React from 'react'
import { View, Text } from 'react-native'

interface BadgeProps {
  label: string
  variant?: 'income' | 'expense' | 'transfer' | 'neutral'
}

const variantMap = {
  income: 'bg-emerald-100',
  expense: 'bg-red-100',
  transfer: 'bg-indigo-100',
  neutral: 'bg-slate-100',
}

const textMap = {
  income: 'text-emerald-700',
  expense: 'text-red-700',
  transfer: 'text-indigo-700',
  neutral: 'text-slate-600',
}

export function Badge({ label, variant = 'neutral' }: BadgeProps) {
  return (
    <View className={`px-2 py-0.5 rounded-full ${variantMap[variant]}`}>
      <Text className={`text-xs font-medium ${textMap[variant]}`}>{label}</Text>
    </View>
  )
}
