import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, Server, Send, ChevronRight, Eye, EyeOff, CheckCircle, XCircle, LogOut, Wallet, Tag } from 'lucide-react'
import { router } from 'expo-router'
import { useAuthStore } from '../../src/store/auth.store'
import { api, authApi } from '../../src/lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────
interface SMTPSettings {
  host: string
  port: string
  user: string
  hasPass: boolean
  from: string
  enabled: boolean
}

// ─── API helpers ─────────────────────────────────────────────────────────────
const settingsApi = {
  getSMTP: () => api.get<SMTPSettings>('/settings/smtp'),
  saveSMTP: (data: Partial<SMTPSettings> & { pass?: string }) =>
    api.put('/settings/smtp', data),
  testSMTP: (email: string) =>
    api.post('/settings/smtp/test', { email }),
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const { user, logout, refreshToken } = useAuthStore()
  const qc = useQueryClient()
  const [section, setSection] = useState<'main' | 'smtp' | 'account'>('main')

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken)
    } catch {}
    logout()
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {section === 'main' && (
        <MainSettings user={user} onLogout={handleLogout} onNavigate={setSection} />
      )}
      {section === 'smtp' && (
        <SMTPSection onBack={() => setSection('main')} />
      )}
      {section === 'account' && (
        <AccountSection user={user} onBack={() => setSection('main')} />
      )}
    </SafeAreaView>
  )
}

// ─── Main Settings List ───────────────────────────────────────────────────────
function MainSettings({ user, onLogout, onNavigate }: {
  user: any
  onLogout: () => void
  onNavigate: (s: 'smtp' | 'account') => void
}) {
  return (
    <ScrollView className="flex-1">
      <View className="p-5">
        <Text className="text-2xl font-bold text-slate-900 mb-6">Pengaturan</Text>

        {/* Profile Card */}
        <TouchableOpacity
          onPress={() => onNavigate('account')}
          className="bg-white rounded-2xl p-4 mb-4 shadow-sm flex-row items-center"
        >
          <View className="w-14 h-14 rounded-full bg-primary items-center justify-center mr-4">
            <Text className="text-white text-xl font-bold">
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-slate-900">{user?.name ?? 'User'}</Text>
            <Text className="text-sm text-slate-500">{user?.email ?? ''}</Text>
            </View>
          <ChevronRight size={18} color="#94a3b8" />
        </TouchableOpacity>

        {/* Data management */}
        <View className="bg-white rounded-2xl mb-4 shadow-sm overflow-hidden">
          <View className="px-4 pt-4 pb-2">
            <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Kelola Data</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/accounts')}
            className="px-4 py-3.5 flex-row justify-between items-center border-t border-slate-50"
          >
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-blue-50 rounded-lg items-center justify-center mr-3">
                <Wallet size={16} color="#3b82f6" />
              </View>
              <Text className="text-base text-slate-800">Rekening & Akun</Text>
            </View>
            <ChevronRight size={16} color="#94a3b8" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/categories')}
            className="px-4 py-3.5 flex-row justify-between items-center border-t border-slate-50"
          >
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-amber-50 rounded-lg items-center justify-center mr-3">
                <Tag size={16} color="#f59e0b" />
              </View>
              <Text className="text-base text-slate-800">Kategori</Text>
            </View>
            <ChevronRight size={16} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* System / Email */}
        <View className="bg-white rounded-2xl mb-4 shadow-sm overflow-hidden">
          <View className="px-4 pt-4 pb-2">
            <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sistem</Text>
          </View>
          <TouchableOpacity
            onPress={() => onNavigate('smtp')}
            className="px-4 py-3.5 flex-row justify-between items-center border-t border-slate-50"
          >
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-purple-50 rounded-lg items-center justify-center mr-3">
                <Mail size={16} color="#8b5cf6" />
              </View>
              <View>
                <Text className="text-base text-slate-800">Konfigurasi Email (SMTP)</Text>
                <Text className="text-xs text-slate-400 mt-0.5">Untuk notifikasi & undangan</Text>
              </View>
            </View>
            <ChevronRight size={16} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          onPress={onLogout}
          className="bg-red-50 border border-red-100 rounded-2xl p-4 flex-row items-center justify-center mt-2"
        >
          <LogOut size={18} color="#ef4444" />
          <Text className="text-red-600 font-semibold text-base ml-2">Keluar</Text>
        </TouchableOpacity>

        <Text className="text-center text-xs text-slate-300 mt-6">FinTrackr v1.0.0 — Self Hosted</Text>
      </View>
    </ScrollView>
  )
}

// ─── Account Section ─────────────────────────────────────────────────────────
function AccountSection({ user, onBack }: { user: any; onBack: () => void }) {
  return (
    <ScrollView className="flex-1">
      <View className="p-5">
        <SectionHeader title="Akun" onBack={onBack} />
        <View className="bg-white rounded-2xl p-5 shadow-sm">
          <View className="items-center">
            <View className="w-20 h-20 rounded-full bg-primary items-center justify-center mb-3">
              <Text className="text-white text-3xl font-bold">
                {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
              </Text>
            </View>
            <Text className="text-lg font-bold text-slate-900">{user?.name}</Text>
            <Text className="text-sm text-slate-500 mt-1">{user?.email}</Text>
            <View className="flex-row items-center mt-2">
              <CheckCircle size={13} color="#10b981" />
              <Text className="text-xs text-emerald-600 ml-1">Masuk via Google</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

// ─── SMTP Configuration Section ──────────────────────────────────────────────
function SMTPSection({ onBack }: { onBack: () => void }) {
  const qc = useQueryClient()

  const { data: smtpData, isLoading } = useQuery({
    queryKey: ['settings', 'smtp'],
    queryFn: () => settingsApi.getSMTP().then(r => r.data),
  })

  const [form, setForm] = useState({
    host: '',
    port: '587',
    user: '',
    pass: '',
    from: '',
    enabled: true,
  })
  const [showPass, setShowPass] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Populate form when data loads
  if (smtpData && !initialized) {
    setForm({
      host: smtpData.host || '',
      port: smtpData.port || '587',
      user: smtpData.user || '',
      pass: '',  // never pre-fill password
      from: smtpData.from || '',
      enabled: smtpData.enabled,
    })
    setInitialized(true)
  }

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => settingsApi.saveSMTP(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'smtp'] })
      setFeedback({ type: 'success', msg: 'Pengaturan SMTP berhasil disimpan!' })
      setTimeout(() => setFeedback(null), 3000)
    },
    onError: (e: any) => {
      setFeedback({ type: 'error', msg: e.response?.data?.message || 'Gagal menyimpan' })
    },
  })

  const testMutation = useMutation({
    mutationFn: () => settingsApi.testSMTP(testEmail),
    onSuccess: (r) => {
      setFeedback({ type: 'success', msg: r.data?.message || 'Email test terkirim!' })
    },
    onError: (e: any) => {
      setFeedback({ type: 'error', msg: e.response?.data?.message || 'Gagal mengirim test email' })
    },
  })

  const set = (key: keyof typeof form, val: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: val }))

  return (
    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
      <View className="p-5">
        <SectionHeader title="Konfigurasi Email (SMTP)" onBack={onBack} />

        {/* Info banner */}
        <View className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
          <Text className="text-blue-800 text-sm font-semibold mb-1">💡 Untuk apa ini?</Text>
          <Text className="text-blue-700 text-xs leading-5">
            Setting ini digunakan untuk mengirim email verifikasi, reset password, dan undangan workspace.
            Gunakan Gmail App Password, atau SMTP provider lain (Mailgun, SendGrid, dsb).
          </Text>
        </View>

        {isLoading ? (
          <View className="items-center py-10">
            <ActivityIndicator color="#1A2B4A" />
          </View>
        ) : (
          <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            {/* Enable toggle */}
            <View className="flex-row justify-between items-center mb-5 pb-4 border-b border-slate-100">
              <View>
                <Text className="text-base font-semibold text-slate-800">Aktifkan Email</Text>
                <Text className="text-xs text-slate-400 mt-0.5">Kirim email dari server ini</Text>
              </View>
              <Switch
                value={form.enabled}
                onValueChange={(v) => set('enabled', v)}
                trackColor={{ false: '#e2e8f0', true: '#1A2B4A' }}
                thumbColor="white"
              />
            </View>

            {/* SMTP Host */}
            <FormField
              label="SMTP Host"
              placeholder="smtp.gmail.com"
              value={form.host}
              onChangeText={(v) => set('host', v)}
              hint="Contoh: smtp.gmail.com · smtp.mailgun.org"
              icon={<Server size={15} color="#94a3b8" />}
            />

            {/* SMTP Port */}
            <FormField
              label="Port"
              placeholder="587"
              value={form.port}
              onChangeText={(v) => set('port', v)}
              keyboardType="numeric"
              hint="587 (STARTTLS) atau 465 (SSL)"
              icon={<Server size={15} color="#94a3b8" />}
            />

            {/* Email / Username */}
            <FormField
              label="Email / Username"
              placeholder="kamu@gmail.com"
              value={form.user}
              onChangeText={(v) => { set('user', v); if (!form.from) set('from', v) }}
              keyboardType="email-address"
              hint="Email pengirim"
              icon={<Mail size={15} color="#94a3b8" />}
            />

            {/* Password */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-slate-700 mb-1.5">
                Password / App Password
                {smtpData?.hasPass && (
                  <Text className="text-xs text-slate-400"> (sudah tersimpan — kosongkan untuk tidak ubah)</Text>
                )}
              </Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4">
                <Lock size={15} color="#94a3b8" />
                <TextInput
                  className="flex-1 ml-3 py-3.5 text-slate-900 text-sm"
                  placeholder={smtpData?.hasPass ? '••••••••' : 'Masukkan password'}
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPass}
                  value={form.pass}
                  onChangeText={(v) => set('pass', v)}
                />
                <TouchableOpacity onPress={() => setShowPass(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  {showPass ? <EyeOff size={15} color="#94a3b8" /> : <Eye size={15} color="#94a3b8" />}
                </TouchableOpacity>
              </View>
              <Text className="text-xs text-slate-400 mt-1">
                Untuk Gmail: gunakan <Text className="font-medium">App Password</Text> (bukan password biasa)
              </Text>
            </View>

            {/* From name / email */}
            <FormField
              label='Nama Pengirim ("From")'
              placeholder="FinTrackr atau kamu@gmail.com"
              value={form.from}
              onChangeText={(v) => set('from', v)}
              hint="Tampil sebagai pengirim di inbox penerima"
              icon={<User size={15} color="#94a3b8" />}
            />

            {/* Feedback */}
            {feedback && (
              <View className={`rounded-xl p-3 mb-4 flex-row items-center ${feedback.type === 'success' ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                {feedback.type === 'success'
                  ? <CheckCircle size={16} color="#10b981" />
                  : <XCircle size={16} color="#ef4444" />}
                <Text className={`ml-2 text-sm flex-1 ${feedback.type === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
                  {feedback.msg}
                </Text>
              </View>
            )}

            {/* Save */}
            <TouchableOpacity
              onPress={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending}
              className={`rounded-xl py-3.5 items-center ${saveMutation.isPending ? 'bg-primary/60' : 'bg-primary'}`}
            >
              {saveMutation.isPending
                ? <ActivityIndicator color="white" size="small" />
                : <Text className="text-white font-bold text-base">Simpan Pengaturan</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Test SMTP */}
        <View className="bg-white rounded-2xl p-5 shadow-sm">
          <Text className="text-base font-semibold text-slate-800 mb-1">Tes Kirim Email</Text>
          <Text className="text-xs text-slate-400 mb-4">
            Kirim email percobaan untuk memastikan konfigurasi benar
          </Text>
          <View className="flex-row gap-3">
            <View className="flex-1 flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4">
              <Mail size={15} color="#94a3b8" />
              <TextInput
                className="flex-1 ml-2 py-3 text-slate-900 text-sm"
                placeholder="email@tujuan.com"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={testEmail}
                onChangeText={setTestEmail}
              />
            </View>
            <TouchableOpacity
              onPress={() => testMutation.mutate()}
              disabled={!testEmail || testMutation.isPending}
              className={`rounded-xl px-4 items-center justify-center ${!testEmail ? 'bg-slate-200' : 'bg-primary'}`}
            >
              {testMutation.isPending
                ? <ActivityIndicator color="white" size="small" />
                : <Send size={18} color={!testEmail ? '#94a3b8' : 'white'} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Gmail guide */}
        <View className="bg-amber-50 border border-amber-100 rounded-xl p-4 mt-4">
          <Text className="text-amber-800 font-semibold text-sm mb-2">📧 Panduan Gmail App Password</Text>
          <Text className="text-amber-700 text-xs leading-5">
            1. Buka myaccount.google.com{'\n'}
            2. Security → 2-Step Verification → aktifkan{'\n'}
            3. Security → App Passwords → buat app "FinTrackr"{'\n'}
            4. Salin 16-karakter password, paste di kolom Password di atas{'\n'}
            5. Host: smtp.gmail.com · Port: 587
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}

// ─── Shared sub-components ───────────────────────────────────────────────────
function SectionHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View className="flex-row items-center mb-6">
      <TouchableOpacity
        onPress={onBack}
        className="w-9 h-9 bg-white rounded-xl items-center justify-center shadow-sm mr-3"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text className="text-slate-600 text-lg">‹</Text>
      </TouchableOpacity>
      <Text className="text-xl font-bold text-slate-900">{title}</Text>
    </View>
  )
}

function FormField({
  label,
  placeholder,
  value,
  onChangeText,
  hint,
  icon,
  keyboardType,
}: {
  label: string
  placeholder: string
  value: string
  onChangeText: (v: string) => void
  hint?: string
  icon?: React.ReactNode
  keyboardType?: any
}) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-slate-700 mb-1.5">{label}</Text>
      <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4">
        {icon}
        <TextInput
          className="flex-1 ml-3 py-3.5 text-slate-900 text-sm"
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={keyboardType}
        />
      </View>
      {hint && <Text className="text-xs text-slate-400 mt-1">{hint}</Text>}
    </View>
  )
}
