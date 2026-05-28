import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { api } from '../../src/lib/api'
import { useAuthStore } from '../../src/store/auth.store'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost/api'

export default function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Handle OAuth redirect: /?access_token=...&refresh_token=...
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const oauthError = params.get('error')

    if (accessToken && refreshToken) {
      window.history.replaceState({}, '', '/')
      setLoading(true)
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
      api.get('/auth/me')
        .then(({ data }) => {
          setAuth(data.user, accessToken, refreshToken)
          router.replace('/(tabs)')
        })
        .catch(() => {
          delete api.defaults.headers.common['Authorization']
          setError('Login gagal. Coba lagi.')
          setLoading(false)
        })
    }

    if (oauthError) {
      window.history.replaceState({}, '', '/')
      const messages: Record<string, string> = {
        google_not_configured: 'Login Google belum dikonfigurasi di server ini.',
        oauth_exchange_failed: 'Gagal verifikasi ke Google. Coba lagi.',
        login_failed: 'Login gagal. Coba lagi.',
      }
      setError(messages[oauthError] ?? 'Terjadi kesalahan. Coba lagi.')
    }
  }, [])

  const handleGoogleLogin = () => {
    if (typeof window !== 'undefined') {
      window.location.href = `${API_URL}/auth/google`
    }
  }

  if (loading) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="large" color="#1A2B4A" />
        <Text className="text-slate-500 mt-4 text-sm">Sedang masuk...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-slate-50 items-center justify-center px-6">
      <View className="w-full max-w-sm">

        {/* Logo */}
        <View className="items-center mb-12">
          <View
            className="w-24 h-24 rounded-3xl items-center justify-center mb-6"
            style={{ backgroundColor: '#1A2B4A' }}
          >
            <Text style={{ color: 'white', fontSize: 36, fontWeight: '800' }}>F</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#1A2B4A', letterSpacing: -0.5 }}>
            FinTrackr
          </Text>
          <Text className="text-slate-500 mt-2 text-base text-center leading-6">
            Lacak keuanganmu otomatis{'\n'}dari email bank & e-wallet
          </Text>
        </View>

        {/* Error */}
        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
            <Text className="text-red-600 text-sm text-center font-medium">{error}</Text>
          </View>
        ) : null}

        {/* Google login button */}
        <TouchableOpacity
          onPress={handleGoogleLogin}
          activeOpacity={0.85}
          className="bg-white rounded-2xl py-4 px-6 flex-row items-center justify-center"
          style={{
            borderWidth: 1.5,
            borderColor: '#E2E8F0',
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 3,
          }}
        >
          {/* Google G */}
          <Text style={{ fontSize: 22, marginRight: 12, lineHeight: 26 }}>G</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>
            Masuk dengan Google
          </Text>
        </TouchableOpacity>

        {/* Tagline */}
        <Text className="text-slate-400 text-xs text-center mt-8 leading-5">
          Dengan masuk, kamu menyetujui syarat penggunaan.{'\n'}
          Data kamu tersimpan di server kamu sendiri.
        </Text>

        <Text className="text-slate-300 text-xs text-center mt-6">FinTrackr v1.0.0</Text>
      </View>
    </View>
  )
}
