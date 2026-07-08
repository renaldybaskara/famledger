import React from 'react'
import { View, ActivityIndicator, Text } from 'react-native'
import { useTheme } from '../../src/lib/theme'

interface LoadingSpinnerProps {
  message?: string
  fullScreen?: boolean
}

export function LoadingSpinner({ message, fullScreen = false }: LoadingSpinnerProps) {
  const C = useTheme()

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', flex: fullScreen ? 1 : undefined, paddingVertical: fullScreen ? 0 : 32, backgroundColor: fullScreen ? C.cream : undefined }}>
      <ActivityIndicator size="large" color={C.primary} />
      {message && (
        <Text style={{ color: C.fg3, fontSize: 13, marginTop: 12, fontFamily: 'Nunito_500Medium' }}>
          {message}
        </Text>
      )}
    </View>
  )
}
