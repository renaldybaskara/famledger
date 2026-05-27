import React from 'react'
import { View, Text } from 'react-native'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-16 px-6">
      {icon && (
        <View className="w-20 h-20 bg-slate-100 rounded-full items-center justify-center mb-4">
          {icon}
        </View>
      )}
      <Text className="text-slate-800 text-lg font-semibold text-center mb-2">{title}</Text>
      {description && (
        <Text className="text-slate-500 text-sm text-center mb-6">{description}</Text>
      )}
      {action}
    </View>
  )
}
