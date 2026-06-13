import React from 'react'
import { View, ActivityIndicator, Text } from 'react-native'

interface LoadingSpinnerProps {
  message?: string
  fullScreen?: boolean
}

export function LoadingSpinner({ message, fullScreen = false }: LoadingSpinnerProps) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', flex: fullScreen ? 1 : undefined, paddingVertical: fullScreen ? 0 : 32 }}>
      <ActivityIndicator size="large" color="#6B8E6B" />
      {message && (
        <Text style={{ color: '#8E887F', fontSize: 13, marginTop: 12, fontFamily: 'Nunito_500Medium' }}>
          {message}
        </Text>
      )}
    </View>
  )
}
