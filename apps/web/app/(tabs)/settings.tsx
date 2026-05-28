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
import { Mail, Lock, Server, Send, ChevronRight, Eye, EyeOff, CheckCircle, XCircle, User, LogOut } from 'lucide-react'
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
  sendVerification: () =>
    api.post('/auth/send-verification'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const { user, logout, refreshToken } = useAuthStore()
  const qc = useQueryClient()
  const [section, setSection] = useState<'main' | 'smtp' | 'password' | 'account'>('main')

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
      {section === 'password' && (
        <ChangePasswordSection onBack={() => setSection('main')} />
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
  onNavigate: (s: 'smtp' | 'password' | 'account') => void
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
            {user?.isEmailVerified === false && (
              <View className="flex-row items-center mt-1">
                <XCircle size={12} color="#ef4444" />
                <Text className="text-xs text-red-500 ml-1">Email belum diverifikasi</Text>
              </View>
            )}
          </View>
          <ChevronRight size={18} color="#94a3b8" />
        </TouchableOpacity>

        {/* Security */}
        <View className="bg-white rounded-2xl mb-4 shadow-sm overflow-hidden">
          <View className="px-4 pt-4 pb-2">
            <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Keamanan</Text>
          </View>
          <TouchableOpacity
            onPress={() => onNavigate('password')}
            className="px-4 py-3.5 flex-row justify-between items-center border-t border-slate-50"
          >
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-blue-50 rounded-lg items-center justify-center mr-3">
                <Lock size={16} color="#3b82f6" />
              </View>
              <Text className="text-base text-slate-800">Ganti Password</Text>
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
                <Text className="text-xs text-slate-400 mt-0.5">Untuk verifikasi & notifikasi</Text>
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
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const handleSendVerification = async () => {
    setLoading(true)
    try {
      await settingsApi.sendVerification()
      setSent(true)
      setMsg('Email verifikasi terkirim! Cek inbox kamu.')
    } catch (e: any) {
      setMsg(e.response?.data?.message || 'Gagal mengirim email verifikasi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView className="flex-1">
      <View className="p-5">
        <SectionHeader title="Akun" onBack={onBack} />

        <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <View className="items-center mb-5">
            <View className="w-20 h-20 rounded-full bg-primary items-center justify-center mb-3">
              <Text className="text-white text-3xl font-bold">
                {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
              </Text>
            </View>
            <Text className="text-lg font-bold text-slate-900">{user?.name}</Text>
            <Text className="text-sm text-slate-500">{user?.email}</Text>
          </View>

          {/* Email verification status */}
          <View className="border border-slate-100 rounded-xl p-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-medium text-slate-700">Status Verifikasi Email</Text>
              {user?.isEmailVerified ? (
                <View className="flex-row items-center">
                  <CheckCircle size={14} color="#10b981" />
                  <Text className="text-xs text-emerald-600 ml-1 font-medium">Terverifikasi</Text>
                </View>
              ) : (
                <View className="flex-row items-center">
                  <XCircle size={14} color="#ef4444" />
                  <Text className="text-xs text-red-500 ml-1 font-medium">Belum diverifikasi</Text>
                </View>
              )}
            </View>

            {!user?.isEmailVerified && (
              <>
                {msg ? (
                  <View className={`rounded-lg p-3 mb-3 ${sent ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <Text className={`text-xs ${sent ? 'text-emerald-700' : 'text-red-600'}`}>{msg}</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  onPress={handleSendVerification}
                  disabled={loading || sent}
                  className={`rounded-xl py-3 items-center ${sent ? 'bg-emerald-100' : 'bg-primary'}`}
                >
                  {loading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text className={`font-semibold text-sm ${sent ? 'text-emerald-700' : 'text-white'}`}>
                      {sent ? '✓ Email Terkirim' : 'Kirim Email Verifikasi'}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
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

// ─── Change Password Section ──────────────────────────────────────────────────
function ChangePasswordSection({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState({ current: '', new: '', confirm: '' })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const mutation = useMutation({
    mutationFn: () => settingsApi.changePassword(form.current, form.new),
    onSuccess: () => {
      setFeedback({ type: 'success', msg: 'Password berhasil diubah!' })
      setForm({ current: '', new: '', confirm: '' })
    },
    onError: (e: any) => {
      setFeedback({ type: 'error', msg: e.response?.data?.message || 'Gagal mengubah password' })
    },
  })

  const handleSubmit = () => {
    setFeedback(null)
    if (form.new.length < 8) {
      setFeedback({ type: 'error', msg: 'Password baru minimal 8 karakter' })
      return
    }
    if (form.new !== form.confirm) {
      setFeedback({ type: 'error', msg: 'Konfirmasi password tidak cocok' })
      return
    }
    mutation.mutate()
  }

  return (
    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
      <View className="p-5">
        <SectionHeader title="Ganti Password" onBack={onBack} />

        <View className="bg-white rounded-2xl p-5 shadow-sm">
          {/* Current password */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-slate-700 mb-1.5">Password Saat Ini</Text>
            <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4">
              <Lock size={15} color="#94a3b8" />
              <TextInput
                className="flex-1 ml-3 py-3.5 text-slate-900 text-sm"
                placeholder="Password lama"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showCurrent}
                value={form.current}
                onChangeText={(v) => setForm(p => ({ ...p, current: v }))}
              />
              <TouchableOpacity onPress={() => setShowCurrent(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                {showCurrent ? <EyeOff size={15} color="#94a3b8" /> : <Eye size={15} color="#94a3b8" />}
              </TouchableOpacity>
            </View>
          </View>

          {/* New password */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-slate-700 mb-1.5">Password Baru</Text>
            <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4">
              <Lock size={15} color="#94a3b8" />
              <TextInput
                className="flex-1 ml-3 py-3.5 text-slate-900 text-sm"
                placeholder="Min. 8 karakter"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showNew}
                value={form.new}
                onChangeText={(v) => setForm(p => ({ ...p, new: v }))}
              />
              <TouchableOpacity onPress={() => setShowNew(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                {showNew ? <EyeOff size={15} color="#94a3b8" /> : <Eye size={15} color="#94a3b8" />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm password */}
          <View className="mb-5">
            <Text className="text-sm font-medium text-slate-700 mb-1.5">Konfirmasi Password Baru</Text>
            <View className={`flex-row items-center bg-slate-50 border rounded-xl px-4 ${form.confirm && form.new !== form.confirm ? 'border-red-300' : 'border-slate-200'}`}>
              <Lock size={15} color="#94a3b8" />
              <TextInput
                className="flex-1 ml-3 py-3.5 text-slate-900 text-sm"
                placeholder="Ulangi password baru"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={form.confirm}
                onChangeText={(v) => setForm(p => ({ ...p, confirm: v }))}
              />
            </View>
            {form.confirm && form.new !== form.confirm && (
              <Text className="text-xs text-red-500 mt-1">Password tidak cocok</Text>
            )}
          </View>

          {/* Feedback */}
          {feedback && (
            <View className={`rounded-xl p-3 mb-4 flex-row items-center ${feedback.type === 'success' ? 'bg-emerald-50' : 'bg-red-50'}`}>
              {feedback.type === 'success'
                ? <CheckCircle size={16} color="#10b981" />
                : <XCircle size={16} color="#ef4444" />}
              <Text className={`ml-2 text-sm flex-1 ${feedback.type === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
                {feedback.msg}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={mutation.isPending}
            className={`rounded-xl py-3.5 items-center ${mutation.isPending ? 'bg-primary/60' : 'bg-primary'}`}
          >
            {mutation.isPending
              ? <ActivityIndicator color="white" size="small" />
              : <Text className="text-white font-bold text-base">Ubah Password</Text>}
          </TouchableOpacity>
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
