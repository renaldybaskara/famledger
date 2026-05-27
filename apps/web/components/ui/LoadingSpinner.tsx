import React from 'react'
import { View, ActivityIndicator, Text } from 'react-native'

interface LoadingSpinnerProps {
  message?: string
  fullScreen?: boolean
}

export function LoadingSpinner({ message, fullScreen = false }: LoadingSpinnerProps) {
  return (
    <View
      className={`items-center justify-center ${fullScreen ? 'flex-1' : 'py-8'}`}
    >
      <ActivityIndicator size="large" color="#1A2B4A" />
      {message && (
        <Text className="text-slate-500 text-sm mt-3">{message}</Text>
      )}
    </View>
  )
}
