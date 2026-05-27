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
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react'
import { authApi } from '../../src/lib/api'
import { useAuthStore } from '../../src/store/auth.store'

const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Nama minimal 2 karakter')
      .max(50, 'Nama maksimal 50 karakter'),
    email: z.string().email('Format email tidak valid'),
    password: z
      .string()
      .min(8, 'Password minimal 8 karakter')
      .regex(/[A-Z]/, 'Password harus mengandung huruf kapital')
      .regex(/[0-9]/, 'Password harus mengandung angka'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Password tidak cocok',
    path: ['confirmPassword'],
  })

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterScreen() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const registerMutation = useMutation({
    mutationFn: (data: { name: string; email: string; password: string }) =>
      authApi.register(data),
    onSuccess: ({ data }) => {
      setAuth(data.user, data.accessToken, data.refreshToken)
      router.replace('/(tabs)')
    },
    onError: (err: any) => {
      setError(
        err.response?.data?.message || 'Pendaftaran gagal. Email mungkin sudah digunakan.'
      )
    },
  })

  const onSubmit = (data: RegisterForm) => {
    setError('')
    registerMutation.mutate({
      name: data.name,
      email: data.email,
      password: data.password,
    })
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
          <View className="mb-8 items-center">
            <View className="w-20 h-20 bg-primary rounded-3xl items-center justify-center mb-5 shadow-lg">
              <Text style={{ color: 'white', fontSize: 28, fontWeight: '800' }}>F</Text>
            </View>
            <Text className="text-3xl font-bold text-primary tracking-tight">FinTrackr</Text>
            <Text className="text-slate-500 mt-1.5 text-base text-center">
              Buat akun dan mulai melacak keuanganmu
            </Text>
          </View>

          {/* Card */}
          <View className="bg-white rounded-3xl shadow-sm p-6 border border-slate-100">
            <Text className="text-xl font-bold text-slate-800 mb-6">Buat Akun Baru</Text>

            {/* Server error */}
            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-xl p-3.5 mb-5">
                <Text className="text-red-600 text-sm text-center font-medium">{error}</Text>
              </View>
            ) : null}

            {/* Name */}
            <View className="mb-4">
              <Text className="text-slate-700 font-semibold mb-2 text-sm">Nama Lengkap</Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View
                    className={`flex-row items-center bg-slate-50 border rounded-xl px-4 ${
                      errors.name ? 'border-red-400' : 'border-slate-200'
                    }`}
                  >
                    <User size={16} color="#94a3b8" />
                    <TextInput
                      className="flex-1 ml-3 py-3.5 text-slate-900 text-base"
                      placeholder="Nama lengkapmu"
                      placeholderTextColor="#94a3b8"
                      autoCapitalize="words"
                      autoComplete="name"
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                    />
                  </View>
                )}
              />
              {errors.name && (
                <Text className="text-red-500 text-xs mt-1.5 ml-1">{errors.name.message}</Text>
              )}
            </View>

            {/* Email */}
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

            {/* Password */}
            <View className="mb-4">
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
                      placeholder="Min. 8 karakter, huruf kapital & angka"
                      placeholderTextColor="#94a3b8"
                      secureTextEntry={!showPassword}
                      autoComplete="new-password"
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
                <Text className="text-red-500 text-xs mt-1.5 ml-1">
                  {errors.password.message}
                </Text>
              )}
            </View>

            {/* Confirm Password */}
            <View className="mb-6">
              <Text className="text-slate-700 font-semibold mb-2 text-sm">
                Konfirmasi Password
              </Text>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View
                    className={`flex-row items-center bg-slate-50 border rounded-xl px-4 ${
                      errors.confirmPassword ? 'border-red-400' : 'border-slate-200'
                    }`}
                  >
                    <Lock size={16} color="#94a3b8" />
                    <TextInput
                      className="flex-1 ml-3 py-3.5 text-slate-900 text-base"
                      placeholder="Ulangi password"
                      placeholderTextColor="#94a3b8"
                      secureTextEntry={!showConfirm}
                      autoComplete="new-password"
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirm((v) => !v)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {showConfirm ? (
                        <EyeOff size={16} color="#94a3b8" />
                      ) : (
                        <Eye size={16} color="#94a3b8" />
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              />
              {errors.confirmPassword && (
                <Text className="text-red-500 text-xs mt-1.5 ml-1">
                  {errors.confirmPassword.message}
                </Text>
              )}
            </View>

            {/* Terms notice */}
            <Text className="text-slate-400 text-xs text-center mb-5 leading-5">
              Dengan mendaftar, kamu menyetujui{' '}
              <Text className="text-primary font-medium">Syarat & Ketentuan</Text> dan{' '}
              <Text className="text-primary font-medium">Kebijakan Privasi</Text> FinTrackr.
            </Text>

            {/* Register button */}
            <TouchableOpacity
              className={`rounded-xl py-4 items-center shadow-sm ${
                registerMutation.isPending ? 'bg-primary/70' : 'bg-primary'
              }`}
              onPress={handleSubmit(onSubmit)}
              disabled={registerMutation.isPending}
              activeOpacity={0.85}
            >
              {registerMutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Buat Akun</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Login link */}
          <View className="flex-row justify-center items-center mt-6">
            <Text className="text-slate-500 text-sm">Sudah punya akun? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="text-primary font-bold text-sm">Masuk</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
