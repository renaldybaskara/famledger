import { useEffect, useState } from 'react'
import { View, ActivityIndicator, Platform } from 'react-native'
import { Redirect, router } from 'expo-router'
import { useAuthStore } from '../src/store/auth.store'

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Small delay to let AsyncStorage hydrate the auth store
    const timer = setTimeout(() => setReady(true), 100)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!ready || Platform.OS !== 'web') return
    const params = new URLSearchParams(window.location.search)
    const gmailConnected = params.get('gmail_connected')
    const gmailError = params.get('gmail_error')

    if (gmailConnected || gmailError) {
      // Store result in sessionStorage so email tab can read it
      if (gmailConnected) {
        sessionStorage.setItem('gmail_connected', gmailConnected)
      } else if (gmailError) {
        sessionStorage.setItem('gmail_error', gmailError)
      }
      // Clean URL immediately — no tokens in address bar
      window.history.replaceState({}, '', '/')
      // Navigate to email tab if authenticated
      if (isAuthenticated) {
        router.replace('/(tabs)/email-integration' as any)
      }
    }
  }, [ready, isAuthenticated])

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator size="large" color="#1A2B4A" />
      </View>
    )
  }

  return <Redirect href={isAuthenticated ? '/(tabs)' : '/(auth)/login'} />
}
