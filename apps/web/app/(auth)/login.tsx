import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Link, router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'
import { authApi } from '../../src/lib/api'
import { useAuthStore } from '../../src/store/auth.store'

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
})
type LoginForm = z.infer<typeof loginSchema>

export default function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
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

  const onSubmit = (data: LoginForm) => {
    setError('')
    loginMutation.mutate(data)
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
          {/* Logo & Branding */}
          <View className="mb-10 items-center">
            <View className="w-20 h-20 bg-primary rounded-3xl items-center justify-center mb-5 shadow-lg">
              <Text style={{ fontSize: 32 }}>₮</Text>
              {/* Using text as logo placeholder */}
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: 'white', fontSize: 28, fontWeight: '800' }}>F</Text>
              </View>
            </View>
            <Text className="text-3xl font-bold text-primary tracking-tight">FinTrackr</Text>
            <Text className="text-slate-500 mt-1.5 text-base text-center">
              Kelola keuanganmu dengan cerdas
            </Text>
          </View>

          {/* Card container */}
          <View className="bg-white rounded-3xl shadow-sm p-6 border border-slate-100">
            <Text className="text-xl font-bold text-slate-800 mb-6">Masuk ke Akun</Text>

            {/* Server error */}
            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-xl p-3.5 mb-5">
                <Text className="text-red-600 text-sm text-center font-medium">{error}</Text>
              </View>
            ) : null}

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
            <View className="mb-6">
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
                      {showPassword ? (
                        <EyeOff size={16} color="#94a3b8" />
                      ) : (
                        <Eye size={16} color="#94a3b8" />
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              />
              {errors.password && (
                <Text className="text-red-500 text-xs mt-1.5 ml-1">{errors.password.message}</Text>
              )}
            </View>

            {/* Login button */}
            <TouchableOpacity
              className={`rounded-xl py-4 items-center shadow-sm ${
                loginMutation.isPending ? 'bg-primary/70' : 'bg-primary'
              }`}
              onPress={handleSubmit(onSubmit)}
              disabled={loginMutation.isPending}
              activeOpacity={0.85}
            >
              {loginMutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Masuk</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-slate-200" />
            <Text className="mx-4 text-slate-400 text-sm">atau</Text>
            <View className="flex-1 h-px bg-slate-200" />
          </View>

          {/* Register link */}
          <View className="flex-row justify-center items-center">
            <Text className="text-slate-500 text-sm">Belum punya akun? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text className="text-primary font-bold text-sm">Daftar Sekarang</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {/* Version */}
          <Text className="text-slate-300 text-xs text-center mt-8">FinTrackr v1.0.0</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
