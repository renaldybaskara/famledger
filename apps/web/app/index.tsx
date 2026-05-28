import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
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
    if (!ready || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const gmailConnected = params.get('gmail_connected')
    const gmailError = params.get('gmail_error')

    if ((gmailConnected || gmailError) && isAuthenticated) {
      const query = gmailConnected
        ? `?gmail_connected=${encodeURIComponent(gmailConnected)}`
        : `?gmail_error=${encodeURIComponent(gmailError!)}`
      window.history.replaceState({}, '', '/')
      router.replace(`/(tabs)/email-integration${query}` as any)
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
