import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { api } from '../../src/lib/api'
import { useAuthStore } from '../../src/store/auth.store'

// Saku colors
const C = {
  cream:       '#FAF7F2',
  heroStart:   '#6B8E6B',
  heroEnd:     '#41594F',
  accent:      '#C97B5C',
  primary:     '#6B8E6B',
  primarySoft: '#DEE8D7',
  danger:      '#C66B6B',
  dangerSoft:  '#F5D9D9',
  fg1:         '#2D2A26',
  fg2:         '#55504A',
  fg3:         '#8E887F',
  surface:     '#FFFFFF',
}

type State = 'loading' | 'success' | 'error' | 'need-login'

export default function AcceptInviteScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [state, setState] = useState<State>('loading')
  const [message, setMessage] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')

    if (!token) {
      setState('error')
      setMessage('Link undangan tidak valid. Token tidak ditemukan.')
      return
    }

    if (!isAuthenticated) {
      // Simpan token di sessionStorage, redirect ke login
      sessionStorage.setItem('invite_token', token)
      setState('need-login')
      return
    }

    // Sudah login — langsung accept
    acceptInvite(token)
  }, [isAuthenticated])

  // Setelah login, cek apakah ada pending invite token
  useEffect(() => {
    if (!isAuthenticated) return
    if (typeof window === 'undefined') return

    const pending = sessionStorage.getItem('invite_token')
    if (pending) {
      sessionStorage.removeItem('invite_token')
      setState('loading')
      acceptInvite(pending)
    }
  }, [isAuthenticated])

  const acceptInvite = async (token: string) => {
    try {
      const { data } = await api.post('/workspaces/invites/accept', { token })
      setWorkspaceName(data?.data?.workspace?.name ?? 'workspace')
      setState('success')
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? ''
      if (msg.toLowerCase().includes('already')) {
        setState('success')
        setWorkspaceName('')
        setMessage('Kamu sudah menjadi anggota workspace ini.')
      } else if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('not found')) {
        setState('error')
        setMessage('Link undangan sudah kadaluarsa atau tidak valid. Minta undangan baru.')
      } else {
        setState('error')
        setMessage(msg || 'Gagal bergabung ke workspace. Coba lagi.')
      }
    }
  }

  const handleLogin = () => {
    router.replace('/(auth)/login')
  }

  const handleGoHome = () => {
    router.replace('/(tabs)')
  }

  const handleGoWorkspace = () => {
    router.replace('/(tabs)/workspace')
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      {/* Decorative blobs */}
      <View style={{ position: 'absolute', top: -80, right: -80, width: 240, height: 240, borderRadius: 999, backgroundColor: C.accent, opacity: 0.15 }} />
      <View style={{ position: 'absolute', bottom: -60, left: -60, width: 200, height: 200, borderRadius: 999, backgroundColor: C.heroStart, opacity: 0.12 }} />

      <View style={{ width: '100%', maxWidth: 360, alignItems: 'center' }}>

        {state === 'loading' && (
          <>
            <View style={{ width: 72, height: 72, borderRadius: 999, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <ActivityIndicator size="large" color={C.primary} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: C.fg1, textAlign: 'center', fontFamily: 'Nunito_800ExtraBold' }}>
              Memproses undangan...
            </Text>
            <Text style={{ fontSize: 14, color: C.fg3, marginTop: 8, textAlign: 'center', fontFamily: 'Nunito_500Medium' }}>
              Sedang bergabung ke workspace
            </Text>
          </>
        )}

        {state === 'need-login' && (
          <>
            <View style={{ width: 72, height: 72, borderRadius: 999, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <Text style={{ fontSize: 36 }}>🌿</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: C.fg1, textAlign: 'center', fontFamily: 'Nunito_900Black', letterSpacing: -0.5 }}>
              Login dulu yuk!
            </Text>
            <Text style={{ fontSize: 14, color: C.fg2, marginTop: 10, textAlign: 'center', lineHeight: 22, fontFamily: 'Nunito_500Medium' }}>
              Kamu diundang untuk bergabung ke workspace Saku.{'\n'}
              Login dengan Google untuk menerima undangan.
            </Text>
            <TouchableOpacity
              onPress={handleLogin}
              style={{
                marginTop: 28, backgroundColor: C.primary, borderRadius: 16,
                paddingVertical: 14, paddingHorizontal: 32,
                flexDirection: 'row', alignItems: 'center', gap: 10,
                shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
              }}
            >
              <Text style={{ fontSize: 16 }}>G</Text>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, fontFamily: 'Nunito_800ExtraBold' }}>
                Masuk dengan Google
              </Text>
            </TouchableOpacity>
          </>
        )}

        {state === 'success' && (
          <>
            <View style={{ width: 80, height: 80, borderRadius: 999, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <Text style={{ fontSize: 40 }}>🎉</Text>
            </View>
            <Text style={{ fontSize: 24, fontWeight: '900', color: C.fg1, textAlign: 'center', fontFamily: 'Nunito_900Black', letterSpacing: -0.5 }}>
              Berhasil bergabung!
            </Text>
            <Text style={{ fontSize: 14, color: C.fg2, marginTop: 10, textAlign: 'center', lineHeight: 22, fontFamily: 'Nunito_500Medium' }}>
              {message || `Kamu sekarang anggota workspace ${workspaceName ? `"${workspaceName}"` : ''}.`}
            </Text>

            <TouchableOpacity
              onPress={handleGoWorkspace}
              style={{
                marginTop: 28, backgroundColor: C.primary, borderRadius: 16,
                paddingVertical: 14, paddingHorizontal: 32,
                shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, fontFamily: 'Nunito_800ExtraBold' }}>
                Lihat Workspace
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleGoHome} style={{ marginTop: 12 }}>
              <Text style={{ color: C.fg3, fontSize: 14, fontFamily: 'Nunito_600SemiBold' }}>Ke Beranda</Text>
            </TouchableOpacity>
          </>
        )}

        {state === 'error' && (
          <>
            <View style={{ width: 80, height: 80, borderRadius: 999, backgroundColor: C.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <Text style={{ fontSize: 40 }}>😕</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: C.fg1, textAlign: 'center', fontFamily: 'Nunito_900Black' }}>
              Undangan tidak valid
            </Text>
            <Text style={{ fontSize: 14, color: C.fg2, marginTop: 10, textAlign: 'center', lineHeight: 22, fontFamily: 'Nunito_500Medium' }}>
              {message}
            </Text>

            <TouchableOpacity
              onPress={handleGoHome}
              style={{
                marginTop: 28, backgroundColor: C.primary, borderRadius: 16,
                paddingVertical: 14, paddingHorizontal: 32,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, fontFamily: 'Nunito_800ExtraBold' }}>
                Ke Beranda
              </Text>
            </TouchableOpacity>
          </>
        )}

      </View>
    </View>
  )
}
