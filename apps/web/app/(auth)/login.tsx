import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, Platform, ScrollView } from 'react-native'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { api } from '../../src/lib/api'
import { useAuthStore } from '../../src/store/auth.store'
import { FamLedgerIcon } from '../../components/ui/SakuLogo'

WebBrowser.maybeCompleteAuthSession()

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost/api'

const C = {
  heroStart:  '#6B8E6B',
  heroEnd:    '#41594F',
  accent:     '#C97B5C',
  cream:      '#FAF7F2',
  creamSunk:  '#F4EEE3',
  surface:    '#FFFFFF',
  fg1:        '#2D2A26',
  fg2:        '#55504A',
  fg3:        '#8E887F',
  border:     '#E0DBD2',
  divider:    '#ECE4D3',
  primary:    '#6B8E6B',
}

const FEATURES = [
  {
    bg: '#E8F5EE',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="#3D7A56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="22,6 12,13 2,6" fill="none" stroke="#3D7A56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Auto-import dari email bank',
    sub: 'BCA, BRI, GoPay, OVO, DANA, dll masuk otomatis',
  },
  {
    bg: '#EDF6FF',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="none" stroke="#5B9BD5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" fill="none" stroke="#5B9BD5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" fill="none" stroke="#5B9BD5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" fill="none" stroke="#5B9BD5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Workspace keluarga',
    sub: 'Kelola keuangan bersama hingga 5 anggota',
  },
  {
    bg: '#F5EDFF',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <line x1="18" y1="20" x2="18" y2="10" stroke="#9B6ED6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="12" y1="20" x2="12" y2="4" stroke="#9B6ED6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="6" y1="20" x2="6" y2="14" stroke="#9B6ED6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Dashboard & budget',
    sub: 'Laporan pengeluaran, tren bulanan, dan alert budget',
  },
  {
    bg: '#FEF9EE',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="#E8A020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Self-hosted & privat',
    sub: 'Data di servermu sendiri, bukan cloud orang lain',
  },
]

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

export default function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
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
    try {
      setLoading(true)
      const redirectUrl = Linking.createURL('auth/callback')
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_URL}/auth/google?mobile=1`,
        redirectUrl
      )
      if (result.type !== 'success' || !result.url) { setLoading(false); return }
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
      <View style={{ flex: 1, backgroundColor: '#41594F', alignItems: 'center', justifyContent: 'center' }}>
        <FamLedgerIcon size={64} rounded />
        <ActivityIndicator size="large" color="rgba(255,255,255,0.9)" style={{ marginTop: 24 }} />
        <Text style={{ color: 'rgba(255,255,255,0.8)', marginTop: 14, fontSize: 14, fontWeight: '600', fontFamily: 'Nunito_600SemiBold' }}>
          Sedang masuk…
        </Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#41594F' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Hero section ── */}
        <View style={{
          backgroundColor: '#41594F',
          paddingTop: 56,
          paddingBottom: 48,
          alignItems: 'center',
          paddingHorizontal: 32,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative circle blobs inside hero */}
          <View style={{
            position: 'absolute', top: -60, right: -60,
            width: 200, height: 200, borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.07)',
          }} />
          <View style={{
            position: 'absolute', bottom: 20, left: -50,
            width: 160, height: 160, borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.05)',
          }} />

          <View style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 24,
            elevation: 10,
            marginBottom: 18,
          }}>
            <FamLedgerIcon size={80} rounded />
          </View>

          <Text style={{
            color: '#FFFFFF',
            fontFamily: 'Nunito_900Black',
            fontSize: 32,
            fontWeight: '900',
            letterSpacing: -0.5,
            lineHeight: 36,
          }}>
            FamLedger
          </Text>

          <Text style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: 15,
            fontWeight: '500',
            fontFamily: 'Nunito_500Medium',
            textAlign: 'center',
            lineHeight: 22,
            marginTop: 10,
            maxWidth: 260,
          }}>
            Catat keuangan keluarga{'\n'}otomatis dari email bank
          </Text>
        </View>

        {/* ── Card section ── */}
        <View style={{
          flex: 1,
          backgroundColor: C.cream,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          marginTop: -20,
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: 40,
        }}>

          {/* Section heading */}
          <Text style={{
            fontSize: 20,
            fontWeight: '900',
            color: C.fg1,
            fontFamily: 'Nunito_900Black',
            marginBottom: 6,
          }}>
            Kenapa FamLedger?
          </Text>
          <Text style={{
            fontSize: 13,
            color: C.fg3,
            fontFamily: 'Nunito_500Medium',
            marginBottom: 24,
          }}>
            Semua yang kamu butuhkan untuk kontrol keuangan keluarga.
          </Text>

          {/* Feature rows */}
          {FEATURES.map(({ icon, bg, title, sub }) => (
            <View key={title} style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 14,
              marginBottom: 18,
            }}>
              <View style={{
                width: 42,
                height: 42,
                borderRadius: 13,
                backgroundColor: bg,
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {Platform.OS === 'web' ? icon : null}
              </View>
              <View style={{ flex: 1, paddingTop: 2 }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: C.fg1,
                  fontFamily: 'Nunito_700Bold',
                  lineHeight: 20,
                }}>
                  {title}
                </Text>
                <Text style={{
                  fontSize: 12,
                  color: C.fg2,
                  fontFamily: 'Nunito_500Medium',
                  lineHeight: 18,
                  marginTop: 1,
                }}>
                  {sub}
                </Text>
              </View>
            </View>
          ))}

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: C.divider, marginVertical: 20 }} />

          {/* Error banner */}
          {error ? (
            <View style={{
              backgroundColor: 'rgba(198,107,107,0.1)',
              borderWidth: 1,
              borderColor: '#C66B6B',
              borderRadius: 14,
              padding: 14,
              marginBottom: 16,
            }}>
              <Text style={{
                color: '#C66B6B',
                fontSize: 13,
                textAlign: 'center',
                fontWeight: '600',
                fontFamily: 'Nunito_600SemiBold',
              }}>
                {error}
              </Text>
            </View>
          ) : null}

          {/* Google login button */}
          <TouchableOpacity
            onPress={handleGoogleLogin}
            activeOpacity={0.88}
            style={{
              backgroundColor: C.surface,
              borderRadius: 16,
              paddingVertical: 15,
              paddingHorizontal: 24,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              borderWidth: 1.5,
              borderColor: C.border,
              shadowColor: '#2D2A26',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 4,
            }}
          >
            {Platform.OS === 'web' ? <GoogleIcon /> : (
              <View style={{ width: 20, height: 20, borderRadius: 999, backgroundColor: C.creamSunk, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#4285F4' }}>G</Text>
              </View>
            )}
            <Text style={{
              fontSize: 16,
              fontWeight: '800',
              color: C.fg1,
              fontFamily: 'Nunito_800ExtraBold',
              letterSpacing: -0.2,
            }}>
              Masuk dengan Google
            </Text>
          </TouchableOpacity>

          {/* Footer note */}
          <Text style={{
            color: C.fg3,
            fontSize: 12,
            textAlign: 'center',
            marginTop: 20,
            lineHeight: 18,
            fontFamily: 'Nunito_500Medium',
          }}>
            Data tersimpan di servermu sendiri, bukan di cloud kami.{'\n'}
            Dengan masuk, kamu menyetujui{' '}
            <Text
              onPress={() => router.push('/terms' as any)}
              style={{ color: C.primary, textDecorationLine: 'underline', fontFamily: 'Nunito_600SemiBold' }}
            >
              Syarat Penggunaan
            </Text>
            {' '}dan{' '}
            <Text
              onPress={() => router.push('/privacy' as any)}
              style={{ color: C.primary, textDecorationLine: 'underline', fontFamily: 'Nunito_600SemiBold' }}
            >
              Kebijakan Privasi
            </Text>
            {' '}kami.
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}
