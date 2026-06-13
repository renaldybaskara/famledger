import { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator, Platform } from 'react-native'
import { router } from 'expo-router'
import { api } from '../../src/lib/api'
import { useAuthStore } from '../../src/store/auth.store'

export default function AuthCallbackScreen() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const [error, setError] = useState('')

  useEffect(() => {
    // On Android/iOS the OAuth callback is handled in login.tsx via WebBrowser
    if (Platform.OS !== 'web') {
      router.replace('/(auth)/login' as any)
      return
    }
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const oauthError = params.get('error')

    if (oauthError) {
      window.history.replaceState({}, '', '/')
      router.replace('/(auth)/login' as any)
      return
    }

    if (!code) {
      router.replace('/(auth)/login' as any)
      return
    }

    // Clean URL immediately — code is one-time use
    window.history.replaceState({}, '', '/')

    // Exchange code for tokens — tokens travel only in POST body, not URL
    api.post('/auth/exchange', { code })
      .then(({ data }) => {
        const { accessToken, refreshToken } = data.data ?? data
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
        return api.get('/auth/me').then(({ data: meData }) => {
          setAuth(meData.user, accessToken, refreshToken)
          router.replace('/(tabs)' as any)
        })
      })
      .catch(() => {
        setError('Login gagal. Coba lagi.')
        delete api.defaults.headers.common['Authorization']
        setTimeout(() => router.replace('/(auth)/login' as any), 2000)
      })
  }, [])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
      {error ? (
        <Text style={{ color: '#ef4444', fontSize: 14 }}>{error}</Text>
      ) : (
        <>
          <ActivityIndicator size="large" color="#1A2B4A" />
          <Text style={{ color: '#64748b', marginTop: 16, fontSize: 14 }}>Sedang masuk...</Text>
        </>
      )}
    </View>
  )
}
