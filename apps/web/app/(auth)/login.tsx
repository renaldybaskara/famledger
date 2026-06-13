import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { api } from '../../src/lib/api'
import { useAuthStore } from '../../src/store/auth.store'
import { SakuIcon, SakuWordmark } from '../../components/ui/SakuLogo'

WebBrowser.maybeCompleteAuthSession()

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost/api'

// Saku colors (inline for login since fonts may not be loaded yet)
const C = {
  heroStart: '#6B8E6B',
  heroEnd:   '#41594F',
  accent:    '#C97B5C',
  cream:     '#FAF7F2',
  white:     '#FFFFFF',
  fg1:       '#2D2A26',
  fg2:       '#55504A',
  fg3:       '#8E887F',
}

export default function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Web: parse token from URL hash (fallback OAuth flow) or error param
    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    const hash = window.location.hash.replace('#', '')
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const oauthError = new URLSearchParams(window.location.search).get('error')

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
        google_not_configured: 'Login Google belum dikonfigurasi.',
        oauth_exchange_failed: 'Gagal verifikasi ke Google. Coba lagi.',
        login_failed: 'Login gagal. Coba lagi.',
      }
      setError(messages[oauthError] ?? 'Terjadi kesalahan. Coba lagi.')
    }
  }, [])

  const handleGoogleLogin = async () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.location.href = `${API_URL}/auth/google`
      }
      return
    }
    // Android/iOS: open OAuth in in-app browser, receive deep link callback
    try {
      setLoading(true)
      const redirectUrl = Linking.createURL('auth/callback')
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_URL}/auth/google?mobile=1`,
        redirectUrl
      )
      if (result.type !== 'success' || !result.url) {
        setLoading(false)
        return
      }
      const parsed = Linking.parse(result.url)
      const code = parsed.queryParams?.code as string | undefined
      const err  = parsed.queryParams?.error as string | undefined
      if (err) {
        const messages: Record<string, string> = {
          google_not_configured: 'Login Google belum dikonfigurasi.',
          oauth_exchange_failed: 'Gagal verifikasi ke Google. Coba lagi.',
          login_failed: 'Login gagal. Coba lagi.',
        }
        setError(messages[err] ?? 'Terjadi kesalahan. Coba lagi.')
        setLoading(false)
        return
      }
      if (!code) { setLoading(false); return }
      const { data } = await api.post('/auth/exchange', { code })
      const { accessToken, refreshToken } = data.data ?? data
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
      const { data: meData } = await api.get('/auth/me')
      setAuth(meData.user, accessToken, refreshToken)
      router.replace('/(tabs)')
    } catch {
      setError('Login gagal. Coba lagi.')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{
          position: 'absolute', top: -80, right: -80,
          width: 280, height: 280, borderRadius: 999,
          backgroundColor: C.accent, opacity: 0.15,
        }} />
        <View style={{
          position: 'absolute', bottom: -60, left: -60,
          width: 220, height: 220, borderRadius: 999,
          backgroundColor: C.heroStart, opacity: 0.12,
        }} />
        <SakuIcon size={56} rounded />
        <ActivityIndicator size="large" color={C.heroStart} style={{ marginTop: 20 }} />
        <Text style={{ color: C.fg2, marginTop: 16, fontSize: 14, fontWeight: '600' }}>
          Sedang masuk…
        </Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.cream }}>
      {/* Decorative blobs */}
      <View style={{
        position: 'absolute', top: -100, right: -100,
        width: 320, height: 320, borderRadius: 999,
        backgroundColor: C.accent, opacity: 0.18,
      }} />
      <View style={{
        position: 'absolute', top: 60, left: -80,
        width: 240, height: 240, borderRadius: 999,
        backgroundColor: C.heroStart, opacity: 0.12,
      }} />
      <View style={{
        position: 'absolute', bottom: -80, right: -60,
        width: 200, height: 200, borderRadius: 999,
        backgroundColor: '#A2BD97', opacity: 0.2,
      }} />

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <View style={{ width: '100%', maxWidth: 360 }}>

          {/* Logo mark */}
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
            {/* App icon (rounded square with inverted mark) */}
            <View style={{
              marginBottom: 20,
              shadowColor: '#2D2A26',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 20,
              elevation: 8,
            }}>
              <SakuIcon size={80} rounded />
            </View>
            {/* Wordmark */}
            <SakuWordmark height={44} />
            <Text style={{
              fontSize: 15, fontWeight: '500', color: C.fg2,
              textAlign: 'center', lineHeight: 22, marginTop: 12,
            }}>
              Catat keuangan keluarga{'\n'}otomatis dari email bank
            </Text>

            {/* Feature pills */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
              {['📧 Auto-import email', '👨‍👩‍👧 Keluarga', '📊 Laporan'].map((label) => (
                <View key={label} style={{
                  backgroundColor: 'rgba(107,142,107,0.12)',
                  borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
                  borderWidth: 1, borderColor: 'rgba(107,142,107,0.2)',
                }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.heroEnd }}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Error */}
          {error ? (
            <View style={{
              backgroundColor: 'rgba(198,107,107,0.1)', borderWidth: 1, borderColor: '#C66B6B',
              borderRadius: 14, padding: 14, marginBottom: 20,
            }}>
              <Text style={{ color: '#C66B6B', fontSize: 13, textAlign: 'center', fontWeight: '600' }}>
                {error}
              </Text>
            </View>
          ) : null}

          {/* Google login button */}
          <TouchableOpacity
            onPress={handleGoogleLogin}
            activeOpacity={0.88}
            style={{
              backgroundColor: C.white,
              borderRadius: 18,
              paddingVertical: 16,
              paddingHorizontal: 24,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: '#E0DBD2',
              shadowColor: '#2D2A26',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.08,
              shadowRadius: 16,
              elevation: 4,
            }}
          >
            {/* Google G icon */}
            <View style={{
              width: 28, height: 28, borderRadius: 999,
              backgroundColor: '#FAF7F2', alignItems: 'center', justifyContent: 'center',
              marginRight: 12,
            }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#4285F4', lineHeight: 20 }}>G</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.fg1, letterSpacing: -0.2 }}>
              Masuk dengan Google
            </Text>
          </TouchableOpacity>

          {/* Tagline */}
          <Text style={{
            color: C.fg3, fontSize: 12, textAlign: 'center',
            marginTop: 24, lineHeight: 18,
          }}>
            Dengan masuk, kamu menyetujui syarat penggunaan.{'\n'}
            Data tersimpan di servermu sendiri. 🔒
          </Text>
        </View>
      </View>
    </View>
  )
}
