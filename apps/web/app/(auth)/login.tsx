import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Eye, EyeOff, Mail, Lock, ChevronDown, ChevronUp } from 'lucide-react'
import { authApi, api } from '../../src/lib/api'
import { useAuthStore } from '../../src/store/auth.store'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost/api'

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
})
type LoginForm = z.infer<typeof loginSchema>

export default function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)

  // Check if Google OAuth is configured on this server
  const { data: googleStatus } = useQuery({
    queryKey: ['google-configured'],
    queryFn: () => api.get<{ configured: boolean }>('/auth/google/configured'),
    retry: false,
    staleTime: Infinity,
  })
  const googleConfigured = googleStatus?.data?.configured ?? false

  // Handle OAuth redirect: ?access_token=...&refresh_token=...
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const oauthError = params.get('error')

    if (accessToken && refreshToken) {
      // Clean URL immediately
      window.history.replaceState({}, '', '/')
      // Fetch user profile then store session
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
      api.get('/auth/me').then(({ data }) => {
        setAuth(data.user, accessToken, refreshToken)
        router.replace('/(tabs)')
      }).catch(() => {
        setError('Login Google gagal. Coba lagi.')
        delete api.defaults.headers.common['Authorization']
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

  const { control, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ data }) => {
      setAuth(data.user, data.accessToken, data.refreshToken)
      router.replace('/(tabs)')
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Email atau password salah. Coba lagi.')
    },
  })

  const handleGoogleLogin = () => {
    // Full browser redirect — Google OAuth must go through the server
    if (typeof window !== 'undefined') {
      window.location.href = `${API_URL}/auth/google`
    } else {
      Linking.openURL(`${API_URL}/auth/google`)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-50"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 justify-center px-6 py-16 max-w-md mx-auto w-full">

          {/* Logo */}
          <View className="mb-10 items-center">
            <View className="w-20 h-20 bg-primary rounded-3xl items-center justify-center mb-5 shadow-lg">
              <Text style={{ color: 'white', fontSize: 28, fontWeight: '800' }}>F</Text>
            </View>
            <Text className="text-3xl font-bold text-primary tracking-tight">FinTrackr</Text>
            <Text className="text-slate-500 mt-1.5 text-base text-center">
              Lacak keuanganmu otomatis dari email
            </Text>
          </View>

          {/* Error banner */}
          {error ? (
            <View className="bg-red-50 border border-red-200 rounded-xl p-3.5 mb-5">
              <Text className="text-red-600 text-sm text-center font-medium">{error}</Text>
            </View>
          ) : null}

          {/* Main card */}
          <View className="bg-white rounded-3xl shadow-sm p-6 border border-slate-100">

            {/* Google login button — primary CTA */}
            {googleConfigured ? (
              <TouchableOpacity
                onPress={handleGoogleLogin}
                activeOpacity={0.85}
                className="flex-row items-center justify-center bg-white border-2 border-slate-200 rounded-xl py-4 px-5 mb-4"
                style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
              >
                {/* Google G logo */}
                <View className="mr-3">
                  <Text style={{ fontSize: 20, lineHeight: 24 }}>G</Text>
                </View>
                <Text className="text-slate-800 font-bold text-base">
                  Lanjutkan dengan Google
                </Text>
              </TouchableOpacity>
            ) : (
              <View className="bg-slate-50 border border-slate-200 rounded-xl py-4 px-5 mb-4 items-center">
                <Text className="text-slate-400 text-sm text-center">
                  Login Google belum dikonfigurasi
                </Text>
              </View>
            )}

            {/* Divider */}
            <View className="flex-row items-center mb-4">
              <View className="flex-1 h-px bg-slate-100" />
              <Text className="mx-3 text-slate-400 text-xs">atau masuk dengan email</Text>
              <View className="flex-1 h-px bg-slate-100" />
            </View>

            {/* Toggle email/password form */}
            <TouchableOpacity
              onPress={() => setShowEmailForm((v) => !v)}
              activeOpacity={0.7}
              className="flex-row items-center justify-center py-2 mb-1"
            >
              <Text className="text-slate-500 text-sm mr-1">
                {showEmailForm ? 'Sembunyikan form' : 'Tampilkan form email & password'}
              </Text>
              {showEmailForm
                ? <ChevronUp size={14} color="#94a3b8" />
                : <ChevronDown size={14} color="#94a3b8" />}
            </TouchableOpacity>

            {/* Collapsible email/password form */}
            {showEmailForm && (
              <View className="mt-3">
                {/* Email field */}
                <View className="mb-4">
                  <Text className="text-slate-700 font-semibold mb-2 text-sm">Email</Text>
                  <Controller
                    control={control}
                    name="email"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <View
                        className={`flex-row items-center bg-slate-50 border rounded-xl px-4 ${
                          errors.email ? 'border-red-400' : 'border-slate-200'
                        }`}
                      >
                        <Mail size={16} color="#94a3b8" />
                        <TextInput
                          className="flex-1 ml-3 py-3.5 text-slate-900 text-base"
                          placeholder="email@contoh.com"
                          placeholderTextColor="#94a3b8"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          autoComplete="email"
                          value={value}
                          onBlur={onBlur}
                          onChangeText={onChange}
                        />
                      </View>
                    )}
                  />
                  {errors.email && (
                    <Text className="text-red-500 text-xs mt-1.5 ml-1">{errors.email.message}</Text>
                  )}
                </View>

                {/* Password field */}
                <View className="mb-5">
                  <Text className="text-slate-700 font-semibold mb-2 text-sm">Password</Text>
                  <Controller
                    control={control}
                    name="password"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <View
                        className={`flex-row items-center bg-slate-50 border rounded-xl px-4 ${
                          errors.password ? 'border-red-400' : 'border-slate-200'
                        }`}
                      >
                        <Lock size={16} color="#94a3b8" />
                        <TextInput
                          className="flex-1 ml-3 py-3.5 text-slate-900 text-base"
                          placeholder="••••••••"
                          placeholderTextColor="#94a3b8"
                          secureTextEntry={!showPassword}
                          autoComplete="current-password"
                          value={value}
                          onBlur={onBlur}
                          onChangeText={onChange}
                        />
                        <TouchableOpacity
                          onPress={() => setShowPassword((v) => !v)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          {showPassword
                            ? <EyeOff size={16} color="#94a3b8" />
                            : <Eye size={16} color="#94a3b8" />}
                        </TouchableOpacity>
                      </View>
                    )}
                  />
                  {errors.password && (
                    <Text className="text-red-500 text-xs mt-1.5 ml-1">{errors.password.message}</Text>
                  )}
                </View>

                <TouchableOpacity
                  className={`rounded-xl py-4 items-center shadow-sm ${
                    loginMutation.isPending ? 'bg-primary/70' : 'bg-primary'
                  }`}
                  onPress={handleSubmit((d) => { setError(''); loginMutation.mutate(d) })}
                  disabled={loginMutation.isPending}
                  activeOpacity={0.85}
                >
                  {loginMutation.isPending
                    ? <ActivityIndicator color="white" />
                    : <Text className="text-white font-bold text-base">Masuk</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Register link */}
          <View className="flex-row justify-center items-center mt-6">
            <Text className="text-slate-500 text-sm">Belum punya akun? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text className="text-primary font-bold text-sm">Daftar Sekarang</Text>
            </TouchableOpacity>
          </View>

          <Text className="text-slate-300 text-xs text-center mt-6">FinTrackr v1.0.0</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
