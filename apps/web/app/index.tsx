import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../src/store/auth.store'
import { BudgetinIcon } from '../components/ui/BudgetinLogo'

const API_URL = process.env.EXPO_PUBLIC_API_URL || '/api'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  heroStart:  '#6B8E6B',
  heroEnd:    '#41594F',
  cream:      '#FAF7F2',
  creamSunk:  '#F4EEE3',
  surface:    '#FFFFFF',
  fg1:        '#2D2A26',
  fg2:        '#55504A',
  fg3:        '#8E887F',
  border:     '#E0DBD2',
  divider:    '#ECE4D3',
  primary:    '#6B8E6B',
  accent:     '#C97B5C',
}

// ─── Feature cards ────────────────────────────────────────────────────────────
const FEATURES = [
  {
    bg: '#E8F5EE',
    iconColor: '#3D7A56',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="#3D7A56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="22,6 12,13 2,6" fill="none" stroke="#3D7A56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    emoji: '📧',
    title: 'Auto-import dari email bank',
    sub: 'BRI, BCA, BNI, Mandiri, CIMB, dll masuk otomatis',
  },
  {
    bg: '#EDF6FF',
    iconColor: '#5B9BD5',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="none" stroke="#5B9BD5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" fill="none" stroke="#5B9BD5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" fill="none" stroke="#5B9BD5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    emoji: '👨‍👩‍👧',
    title: 'Workspace keluarga',
    sub: 'Kelola keuangan bersama hingga 5 anggota, dengan role berbeda',
  },
  {
    bg: '#F5EDFF',
    iconColor: '#9B6ED6',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <line x1="18" y1="20" x2="18" y2="10" stroke="#9B6ED6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="12" y1="20" x2="12" y2="4" stroke="#9B6ED6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="6" y1="20" x2="6" y2="14" stroke="#9B6ED6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    emoji: '📊',
    title: 'Dashboard & budget',
    sub: 'Tren bulanan, top kategori, dan alert saat budget hampir habis',
  },
  {
    bg: '#FEF9EE',
    iconColor: '#E8A020',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="#E8A020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    emoji: '🔒',
    title: 'Self-hosted & privat',
    sub: 'Data di servermu sendiri — bukan di cloud orang lain',
  },
]


// ─── Main component ───────────────────────────────────────────────────────────
export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [ready, setReady] = useState(false)

  // Wait for AsyncStorage to hydrate the auth store
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 150)
    return () => clearTimeout(timer)
  }, [])

  // Handle Gmail OAuth callback params (gmail_connected / gmail_error)
  useEffect(() => {
    if (!ready || Platform.OS !== 'web') return
    const params = new URLSearchParams(window.location.search)
    const gmailConnected = params.get('gmail_connected')
    const gmailError     = params.get('gmail_error')

    if (gmailConnected || gmailError) {
      if (gmailConnected) sessionStorage.setItem('gmail_connected', gmailConnected)
      if (gmailError)     sessionStorage.setItem('gmail_error', gmailError)
      window.history.replaceState({}, '', '/')
      if (isAuthenticated) {
        router.replace('/(tabs)/email-integration' as any)
      }
    }
  }, [ready, isAuthenticated])

  // Redirect authenticated users straight to dashboard
  useEffect(() => {
    if (ready && isAuthenticated) {
      router.replace('/(tabs)' as any)
    }
  }, [ready, isAuthenticated])

  const handleGoogleLogin = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = `${API_URL}/auth/google`
    } else {
      router.push('/(auth)/login' as any)
    }
  }

  // Loading spinner while store hydrates
  if (!ready) {
    return (
      <View style={{
        flex: 1, alignItems: 'center', justifyContent: 'center',
        backgroundColor: C.heroEnd,
      }}>
        <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" />
      </View>
    )
  }

  // ── Public landing page (unauthenticated) ──────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.heroEnd }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <View style={{
          backgroundColor: C.heroEnd,
          paddingTop: 64,
          paddingBottom: 52,
          alignItems: 'center',
          paddingHorizontal: 32,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative blobs */}
          <View style={{
            position: 'absolute', top: -60, right: -60,
            width: 220, height: 220, borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.06)',
          }} />
          <View style={{
            position: 'absolute', bottom: 10, left: -50,
            width: 170, height: 170, borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.04)',
          }} />

          <BudgetinIcon size={84} />

          <Text style={{
            color: '#FFFFFF',
            fontFamily: 'Nunito_900Black',
            fontSize: 36,
            fontWeight: '900',
            letterSpacing: -0.5,
            lineHeight: 40,
            marginTop: 20,
          }}>
            Budgetin
          </Text>

          <Text style={{
            color: 'rgba(255,255,255,0.75)',
            fontSize: 16,
            fontWeight: '500',
            fontFamily: 'Nunito_500Medium',
            textAlign: 'center',
            lineHeight: 24,
            marginTop: 10,
            maxWidth: 280,
          }}>
            Pencatatan keuangan keluarga{'\n'}otomatis dari email bank
          </Text>

          {/* CTA button */}
          <TouchableOpacity
            onPress={handleGoogleLogin}
            activeOpacity={0.85}
            style={{
              marginTop: 32,
              width: '100%',
              maxWidth: 320,
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              paddingVertical: 15,
              paddingHorizontal: 24,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            {Platform.OS === 'web' ? (
              <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
            ) : null}
            <Text style={{
              fontSize: 16,
              fontWeight: '800',
              color: C.heroEnd,
              fontFamily: 'Nunito_800ExtraBold',
              letterSpacing: -0.2,
            }}>
              Masuk dengan Google
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── FEATURES ───────────────────────────────────────────────────── */}
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

          <Text style={{
            fontSize: 20,
            fontWeight: '900',
            color: C.fg1,
            fontFamily: 'Nunito_900Black',
            marginBottom: 6,
          }}>
            Kenapa Budgetin?
          </Text>
          <Text style={{
            fontSize: 13,
            color: C.fg3,
            fontFamily: 'Nunito_500Medium',
            marginBottom: 28,
          }}>
            Semua yang kamu butuhkan untuk kontrol keuangan keluarga.
          </Text>

          {FEATURES.map(({ icon, emoji, bg, title, sub }) => (
            <View key={title} style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 14,
              marginBottom: 20,
            }}>
              <View style={{
                width: 44, height: 44, borderRadius: 14,
                backgroundColor: bg,
                alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {Platform.OS === 'web'
                  ? icon
                  : <Text style={{ fontSize: 20 }}>{emoji}</Text>
                }
              </View>
              <View style={{ flex: 1, paddingTop: 2 }}>
                <Text style={{
                  fontSize: 14, fontWeight: '700', color: C.fg1,
                  fontFamily: 'Nunito_700Bold', lineHeight: 20,
                }}>
                  {title}
                </Text>
                <Text style={{
                  fontSize: 12, color: C.fg2,
                  fontFamily: 'Nunito_500Medium', lineHeight: 18, marginTop: 2,
                }}>
                  {sub}
                </Text>
              </View>
            </View>
          ))}

          {/* ── DIVIDER ──────────────────────────────────────────────────── */}
          <View style={{ height: 1, backgroundColor: C.divider, marginVertical: 24 }} />

          {/* ── SECONDARY CTA ────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={handleGoogleLogin}
            activeOpacity={0.88}
            style={{
              backgroundColor: C.heroEnd,
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: 'center',
              shadowColor: C.heroEnd,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.25,
              shadowRadius: 16,
              elevation: 6,
            }}
          >
            <Text style={{
              fontSize: 16, fontWeight: '800', color: '#FFFFFF',
              fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.2,
            }}>
              Mulai Sekarang — Gratis
            </Text>
          </TouchableOpacity>

          {/* ── FOOTER — privacy link visible to Google crawler ──────────── */}
          {Platform.OS === 'web' ? (
            /*
             * Using native <p> + <a> tags so Google's crawler can discover
             * the privacy policy link without executing JavaScript.
             * This satisfies Google OAuth homepage requirement #2.
             */
            <p style={{
              color: C.fg3,
              fontSize: 12,
              textAlign: 'center',
              marginTop: 24,
              lineHeight: '18px',
              fontFamily: 'Nunito_500Medium, sans-serif',
            } as any}>
              Self-hosted · Data di servermu sendiri.{' '}
              <a
                href="/privacy"
                style={{
                  color: C.primary,
                  textDecoration: 'underline',
                  fontFamily: 'Nunito_600SemiBold, sans-serif',
                } as any}
              >
                Kebijakan Privasi
              </a>
              {' '}·{' '}
              <a
                href="/terms"
                style={{
                  color: C.primary,
                  textDecoration: 'underline',
                  fontFamily: 'Nunito_600SemiBold, sans-serif',
                } as any}
              >
                Syarat Penggunaan
              </a>
            </p>
          ) : (
            <Text style={{
              color: C.fg3, fontSize: 12, textAlign: 'center',
              marginTop: 24, lineHeight: 18,
              fontFamily: 'Nunito_500Medium',
            }}>
              Self-hosted · Data di servermu sendiri.{' '}
              <Text
                onPress={() => router.push('/privacy' as any)}
                style={{ color: C.primary, textDecorationLine: 'underline', fontFamily: 'Nunito_600SemiBold' }}
              >
                Kebijakan Privasi
              </Text>
              {' '}·{' '}
              <Text
                onPress={() => router.push('/terms' as any)}
                style={{ color: C.primary, textDecorationLine: 'underline', fontFamily: 'Nunito_600SemiBold' }}
              >
                Syarat Penggunaan
              </Text>
            </Text>
          )}

          {/* ── COPYRIGHT ────────────────────────────────────────────────── */}
          <Text style={{
            color: C.fg3, fontSize: 11, textAlign: 'center',
            marginTop: 12, fontFamily: 'Nunito_500Medium',
          }}>
            © 2026 Budgetin · Self-Hosted Financial Tracker
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}
