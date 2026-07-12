import React from 'react'
import { View, Text } from 'react-native'
import { useTheme } from '../../src/lib/theme'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  const C = useTheme()

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64, paddingHorizontal: 24 }}>
      {icon && (
        <View style={{ width: 80, height: 80, backgroundColor: C.creamSunken, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          {icon}
        </View>
      )}
      <Text style={{ fontSize: 18, fontWeight: '800', color: C.fg2, textAlign: 'center', marginBottom: 6, fontFamily: 'Inter_800ExtraBold' }}>
        {title}
      </Text>
      {description && (
        <Text style={{ fontSize: 14, color: C.fg3, textAlign: 'center', marginBottom: 24, lineHeight: 20, fontFamily: 'Inter_500Medium' }}>
          {description}
        </Text>
      )}
      {action}
    </View>
  )
}
