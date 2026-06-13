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
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64, paddingHorizontal: 24 }}>
      {icon && (
        <View style={{ width: 80, height: 80, backgroundColor: '#F4EEE3', borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          {icon}
        </View>
      )}
      <Text style={{ fontSize: 18, fontWeight: '800', color: '#55504A', textAlign: 'center', marginBottom: 6, fontFamily: 'Nunito_800ExtraBold' }}>
        {title}
      </Text>
      {description && (
        <Text style={{ fontSize: 14, color: '#8E887F', textAlign: 'center', marginBottom: 24, lineHeight: 20, fontFamily: 'Nunito_500Medium' }}>
          {description}
        </Text>
      )}
      {action}
    </View>
  )
}
