import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native'

// Web-safe alert helper
const webAlert = (title: string, msg?: string) => {
  if (typeof window !== 'undefined') {
    window.alert(msg ? `${title}\n\n${msg}` : title)
  }
}
const webConfirm = (msg: string): boolean => {
  if (typeof window !== 'undefined') return window.confirm(msg)
  return false
}
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Mail, Plus, Trash2, RefreshCw, CheckCircle, XCircle,
  ChevronRight, ArrowLeft, Wifi, WifiOff, AlertCircle,
  Inbox, RotateCcw, Eye, EyeOff, Server,
} from 'lucide-react'
import { api } from '../../src/lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────
interface EmailIntegration {
  id: string
  email: string
  provider: 'gmail' | 'imap'
  isActive: boolean
  lastSyncAt: string | null
  imapHost?: string
  imapPort?: number
  imapUser?: string
  createdAt: string
}

interface EmailMessage {
  id: string
  subject: string
  from: string
  receivedAt: string
  parseStatus: 'pending' | 'imported' | 'skipped' | 'failed'
  parsedBank?: string
  parsedType?: string
  parsedAmount?: number
  parsedMerchant?: string
  parseError?: string
  skipReason?: string
  transactionId?: string
}

// ─── API helpers ─────────────────────────────────────────────────────────────
const emailApi = {
  listIntegrations: () => api.get<EmailIntegration[]>('/email-integrations'),
  getGmailAuthUrl: () => api.get<{ url: string }>('/email-integrations/gmail/auth'),
  connectIMAP: (data: {
    email: string; imapHost: string; imapPort: number
    imapUser: string; imapPassword: string
  }) => api.post('/email-integrations/imap', data),
  disconnect: (id: string) => api.delete(`/email-integrations/${id}`),
  toggle: (id: string) => api.patch(`/email-integrations/${id}/toggle`),
  sync: (id: string) => api.post(`/email-integrations/${id}/sync`),
  listMessages: (params?: { integrationId?: string; status?: string; page?: number }) =>
    api.get<{ data: EmailMessage[]; total: number; page: number }>('/email-messages', { params }),
  reprocess: (id: string) => api.post(`/email-messages/${id}/reprocess`),
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function EmailIntegrationScreen() {
  const [view, setView] = useState<'list' | 'add-gmail' | 'add-imap' | 'messages'>('list')
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const qc = useQueryClient()

  // Handle result from Gmail OAuth (stored in sessionStorage by index.tsx)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const connected = sessionStorage.getItem('gmail_connected')
    const gmailError = sessionStorage.getItem('gmail_error')

    if (connected) {
      sessionStorage.removeItem('gmail_connected')
      setToast({ type: 'success', msg: `Gmail ${connected} berhasil dihubungkan!` })
    } else if (gmailError) {
      sessionStorage.removeItem('gmail_error')
      const msgs: Record<string, string> = {
        missing_code: 'OAuth gagal — tidak ada kode dari Google.',
        invalid_state: 'OAuth gagal — state tidak valid.',
        oauth_failed: 'Gagal menghubungkan Gmail. Coba lagi.',
        not_configured: 'Google OAuth belum dikonfigurasi di server.',
      }
      setToast({ type: 'error', msg: msgs[gmailError] ?? 'Gagal menghubungkan Gmail.' })
    }
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Toast notification */}
      {toast && (
        <TouchableOpacity
          onPress={() => setToast(null)}
          className={`mx-4 mt-3 p-3 rounded-xl flex-row items-center ${
            toast.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          {toast.type === 'success'
            ? <CheckCircle size={16} color="#10b981" />
            : <XCircle size={16} color="#ef4444" />}
          <Text className={`ml-2 text-sm font-medium flex-1 ${
            toast.type === 'success' ? 'text-emerald-700' : 'text-red-600'
          }`}>{toast.msg}</Text>
        </TouchableOpacity>
      )}

      {view === 'list' && (
        <IntegrationList
          onAddGmail={() => setView('add-gmail')}
          onAddIMAP={() => setView('add-imap')}
          onViewMessages={(id) => { setSelectedIntegrationId(id); setView('messages') }}
        />
      )}
      {view === 'add-gmail' && (
        <ConnectGmailView onBack={() => setView('list')} onSuccess={() => setView('list')} />
      )}
      {view === 'add-imap' && (
        <ConnectIMAPView onBack={() => setView('list')} onSuccess={() => setView('list')} />
      )}
      {view === 'messages' && (
        <EmailMessagesView
          integrationId={selectedIntegrationId}
          onBack={() => setView('list')}
        />
      )}
    </SafeAreaView>
  )
}

// ─── Integration List ─────────────────────────────────────────────────────────
function IntegrationList({ onAddGmail, onAddIMAP, onViewMessages }: {
  onAddGmail: () => void
  onAddIMAP: () => void
  onViewMessages: (id: string) => void
}) {
  const qc = useQueryClient()
  const { data: integrationsRaw, isLoading, refetch } = useQuery({
    queryKey: ['email-integrations'],
    queryFn: () => emailApi.listIntegrations().then(r => r.data),
  })
  // Ensure always array regardless of API response shape
  const integrations: EmailIntegration[] = Array.isArray(integrationsRaw)
    ? integrationsRaw
    : (integrationsRaw as any)?.data ?? []

  const syncMut = useMutation({
    mutationFn: (id: string) => emailApi.sync(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-integrations'] })
      qc.invalidateQueries({ queryKey: ['email-messages'] })
      webAlert('Sync dimulai', 'Memeriksa email baru... Cek tab Pesan dalam beberapa saat.')
    },
    onError: () => webAlert('Gagal', 'Tidak bisa memulai sync. Cek koneksi IMAP/Gmail.'),
  })

  const toggleMut = useMutation({
    mutationFn: (id: string) => emailApi.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-integrations'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => emailApi.disconnect(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-integrations'] }),
  })

  const handleDelete = (id: string, email: string) => {
    if (webConfirm(`Hapus koneksi dengan ${email}?\nEmail yang sudah diimport tidak terpengaruh.`)) {
      deleteMut.mutate(id)
    }
  }

  return (
    <ScrollView
      className="flex-1"
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      <View className="p-5">
        <Text className="text-2xl font-bold text-slate-900 mb-2">Integrasi Email</Text>
        <Text className="text-sm text-slate-500 mb-6">
          Hubungkan email untuk auto-import transaksi dari notifikasi bank & e-wallet
        </Text>

        {/* Connected integrations */}
        {isLoading ? (
          <ActivityIndicator className="my-8" />
        ) : integrations?.length === 0 ? (
          <View className="bg-white rounded-2xl p-8 items-center shadow-sm mb-6">
            <View className="w-16 h-16 bg-blue-50 rounded-full items-center justify-center mb-4">
              <Mail size={32} color="#3b82f6" />
            </View>
            <Text className="text-base font-semibold text-slate-700 mb-2">Belum ada email terhubung</Text>
            <Text className="text-sm text-slate-400 text-center">
              Hubungkan Gmail atau email lain untuk otomatis import transaksi dari BRI, BCA, GoPay, dll.
            </Text>
          </View>
        ) : (
          <View className="mb-6">
            {integrations?.map(integ => (
              <View key={integ.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
                {/* Header */}
                <View className="flex-row items-center mb-3">
                  <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                    integ.provider === 'gmail' ? 'bg-red-50' : 'bg-blue-50'
                  }`}>
                    <Mail size={20} color={integ.provider === 'gmail' ? '#ef4444' : '#3b82f6'} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-slate-800">{integ.email}</Text>
                    <Text className="text-xs text-slate-400">
                      {integ.provider === 'gmail' ? 'Gmail OAuth' : `IMAP · ${integ.imapHost}`}
                    </Text>
                  </View>
                  {/* Status badge */}
                  <View className={`px-2 py-1 rounded-full flex-row items-center ${
                    integ.isActive ? 'bg-green-50' : 'bg-slate-100'
                  }`}>
                    {integ.isActive
                      ? <Wifi size={12} color="#22c55e" />
                      : <WifiOff size={12} color="#94a3b8" />}
                    <Text className={`text-xs ml-1 font-medium ${
                      integ.isActive ? 'text-green-600' : 'text-slate-400'
                    }`}>
                      {integ.isActive ? 'Aktif' : 'Nonaktif'}
                    </Text>
                  </View>
                </View>

                {/* Last sync */}
                {integ.lastSyncAt && (
                  <Text className="text-xs text-slate-400 mb-3">
                    Sync terakhir: {new Date(integ.lastSyncAt).toLocaleString('id-ID')}
                  </Text>
                )}

                {/* Actions */}
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => syncMut.mutate(integ.id)}
                    disabled={!integ.isActive || syncMut.isPending}
                    className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center ${
                      integ.isActive ? 'bg-primary' : 'bg-slate-100'
                    }`}
                  >
                    {syncMut.isPending
                      ? <ActivityIndicator size="small" color="white" />
                      : <RefreshCw size={14} color={integ.isActive ? 'white' : '#94a3b8'} />}
                    <Text className={`text-xs font-semibold ml-1.5 ${
                      integ.isActive ? 'text-white' : 'text-slate-400'
                    }`}>Sync Sekarang</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => onViewMessages(integ.id)}
                    className="flex-1 py-2.5 rounded-xl flex-row items-center justify-center bg-blue-50"
                  >
                    <Inbox size={14} color="#3b82f6" />
                    <Text className="text-xs font-semibold text-blue-600 ml-1.5">Lihat Email</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => toggleMut.mutate(integ.id)}
                    className="px-3 py-2.5 rounded-xl bg-slate-100"
                  >
                    {integ.isActive
                      ? <WifiOff size={14} color="#94a3b8" />
                      : <Wifi size={14} color="#22c55e" />}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDelete(integ.id, integ.email)}
                    className="px-3 py-2.5 rounded-xl bg-red-50"
                  >
                    <Trash2 size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Add buttons */}
        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Tambah Integrasi Baru
        </Text>

        {/* Gmail */}
        <TouchableOpacity
          onPress={onAddGmail}
          className="bg-white rounded-2xl p-4 mb-3 shadow-sm flex-row items-center"
        >
          <View className="w-12 h-12 bg-red-50 rounded-xl items-center justify-center mr-4">
            <Mail size={24} color="#ef4444" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-slate-800">Hubungkan Gmail</Text>
            <Text className="text-xs text-slate-400 mt-0.5">Login dengan Google — paling mudah</Text>
          </View>
          <ChevronRight size={18} color="#94a3b8" />
        </TouchableOpacity>

        {/* IMAP */}
        <TouchableOpacity
          onPress={onAddIMAP}
          className="bg-white rounded-2xl p-4 mb-3 shadow-sm flex-row items-center"
        >
          <View className="w-12 h-12 bg-blue-50 rounded-xl items-center justify-center mr-4">
            <Server size={24} color="#3b82f6" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-slate-800">Hubungkan via IMAP</Text>
            <Text className="text-xs text-slate-400 mt-0.5">Outlook, Yahoo, atau email lain</Text>
          </View>
          <ChevronRight size={18} color="#94a3b8" />
        </TouchableOpacity>

        {/* Info box */}
        <View className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mt-2">
          <Text className="text-xs font-semibold text-blue-700 mb-2">Bank & E-Wallet yang Didukung</Text>
          <Text className="text-xs text-blue-600 leading-5">
            BCA · Mandiri · BRI · BNI · GoPay · OVO · DANA · ShopeePay · Jenius · Livin' · BSI · CIMB · Permata · Flip · LinkAja · Danamon · BTN
          </Text>
          <Text className="text-xs text-blue-500 mt-2">
            Email notifikasi transaksi otomatis diubah menjadi transaksi — polling setiap 5 menit.
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}

// ─── Connect Gmail ────────────────────────────────────────────────────────────
function ConnectGmailView({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleConnect = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await emailApi.getGmailAuthUrl()
      // On web: redirect browser to Google OAuth URL
      if (typeof window !== 'undefined') {
        window.location.href = data.url
      } else {
        await Linking.openURL(data.url)
      }
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || 'Gagal mendapatkan URL login Google.'
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <ScrollView className="flex-1">
      <View className="p-5">
        <PageHeader title="Hubungkan Gmail" onBack={onBack} />

        <View className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <View className="items-center mb-6">
            <View className="w-20 h-20 bg-red-50 rounded-full items-center justify-center mb-4">
              <Mail size={40} color="#ef4444" />
            </View>
            <Text className="text-lg font-bold text-slate-800 mb-2">Login dengan Google</Text>
            <Text className="text-sm text-slate-500 text-center leading-5">
              Izinkan FinTrackr membaca email notifikasi transaksi dari inbox Gmail kamu.
              Kami hanya membaca email — tidak bisa kirim atau hapus.
            </Text>
          </View>

          {/* Steps */}
          <View className="bg-slate-50 rounded-xl p-4 mb-5">
            <Text className="text-xs font-semibold text-slate-600 mb-3">Cara kerjanya:</Text>
            {[
              'Tap tombol di bawah → browser terbuka',
              'Login dengan akun Google yang menerima notif bank',
              'Izinkan akses "read-only" ke Gmail',
              'Kembali ke app — email otomatis terhubung',
              'Worker mulai scan inbox setiap 5 menit',
            ].map((step, i) => (
              <View key={i} className="flex-row items-start mb-2">
                <View className="w-5 h-5 bg-primary rounded-full items-center justify-center mr-2 mt-0.5">
                  <Text className="text-white text-xs font-bold">{i + 1}</Text>
                </View>
                <Text className="text-sm text-slate-600 flex-1">{step}</Text>
              </View>
            ))}
          </View>

          {error ? (
            <View className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 flex-row items-start">
              <AlertCircle size={16} color="#ef4444" className="mr-2 mt-0.5" />
              <Text className="text-sm text-red-600 flex-1">{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleConnect}
            disabled={loading}
            className="bg-red-500 py-4 rounded-xl flex-row items-center justify-center"
          >
            {loading
              ? <ActivityIndicator color="white" />
              : <>
                  <Mail size={18} color="white" />
                  <Text className="text-white font-bold text-base ml-2">Login dengan Google</Text>
                </>}
          </TouchableOpacity>
        </View>

        <View className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <Text className="text-xs font-semibold text-amber-700 mb-1">⚠️ Perlu Google OAuth</Text>
          <Text className="text-xs text-amber-600 leading-4">
            Fitur ini butuh GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET di file .env. Jika belum dikonfigurasi, hubungi administrator server.
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}

// ─── Connect IMAP ─────────────────────────────────────────────────────────────
function ConnectIMAPView({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    email: '',
    imapHost: '',
    imapPort: '993',
    imapUser: '',
    imapPassword: '',
  })
  const [showPass, setShowPass] = useState(false)
  const [preset, setPreset] = useState('')

  const PRESETS: Record<string, { host: string; port: string }> = {
    gmail:   { host: 'imap.gmail.com', port: '993' },
    outlook: { host: 'outlook.office365.com', port: '993' },
    yahoo:   { host: 'imap.mail.yahoo.com', port: '993' },
  }

  const applyPreset = (key: string) => {
    setPreset(key)
    setForm(f => ({ ...f, ...PRESETS[key], imapUser: f.email }))
  }

  const connectMut = useMutation({
    mutationFn: () => emailApi.connectIMAP({
      email: form.email,
      imapHost: form.imapHost,
      imapPort: parseInt(form.imapPort, 10),
      imapUser: form.imapUser || form.email,
      imapPassword: form.imapPassword,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-integrations'] })
      webAlert('Berhasil!', 'Email terhubung. Worker akan mulai scan inbox dalam beberapa menit.')
      onSuccess()
    },
    onError: (e: any) => {
      webAlert('Gagal', e.response?.data?.error || 'Tidak bisa terhubung ke server IMAP. Periksa host, port, dan password.')
    },
  })

  const isValid = form.email && form.imapHost && form.imapPort && form.imapPassword

  return (
    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
      <View className="p-5">
        <PageHeader title="Hubungkan via IMAP" onBack={onBack} />

        {/* Presets */}
        <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <Text className="text-xs font-semibold text-slate-500 mb-3">Provider cepat:</Text>
          <View className="flex-row gap-2">
            {Object.keys(PRESETS).map(key => (
              <TouchableOpacity
                key={key}
                onPress={() => applyPreset(key)}
                className={`px-4 py-2 rounded-xl border ${
                  preset === key
                    ? 'bg-primary border-primary'
                    : 'bg-white border-slate-200'
                }`}
              >
                <Text className={`text-sm font-medium capitalize ${
                  preset === key ? 'text-white' : 'text-slate-700'
                }`}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Form */}
        <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <FormField
            label="Email"
            placeholder="kamu@gmail.com"
            value={form.email}
            onChangeText={(v) => setForm(f => ({ ...f, email: v, imapUser: v }))}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <FormField
            label="IMAP Host"
            placeholder="imap.gmail.com"
            value={form.imapHost}
            onChangeText={(v) => setForm(f => ({ ...f, imapHost: v }))}
            autoCapitalize="none"
          />
          <View className="flex-row gap-3">
            <View className="w-28">
              <FormField
                label="Port"
                placeholder="993"
                value={form.imapPort}
                onChangeText={(v) => setForm(f => ({ ...f, imapPort: v }))}
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1">
              <FormField
                label="Username (opsional)"
                placeholder="sama dengan email"
                value={form.imapUser}
                onChangeText={(v) => setForm(f => ({ ...f, imapUser: v }))}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Password with toggle */}
          <Text className="text-xs font-semibold text-slate-500 mb-1.5">Password / App Password</Text>
          <View className="flex-row items-center border border-slate-200 rounded-xl px-3 mb-1">
            <TextInput
              className="flex-1 py-3 text-sm text-slate-800"
              placeholder="App password dari Google/provider"
              value={form.imapPassword}
              onChangeText={(v) => setForm(f => ({ ...f, imapPassword: v }))}
              secureTextEntry={!showPass}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPass(s => !s)} className="p-1">
              {showPass
                ? <EyeOff size={16} color="#94a3b8" />
                : <Eye size={16} color="#94a3b8" />}
            </TouchableOpacity>
          </View>

          {/* Gmail app password hint */}
          {(preset === 'gmail' || form.imapHost.includes('gmail')) && (
            <View className="bg-amber-50 rounded-xl p-3 mb-3">
              <Text className="text-xs text-amber-700 font-semibold mb-1">Gmail: Perlu App Password</Text>
              <Text className="text-xs text-amber-600 leading-4">
                Gmail tidak izinkan password biasa via IMAP. Buat App Password di:{' '}
                myaccount.google.com → Security → 2-Step Verification → App Passwords
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={() => connectMut.mutate()}
            disabled={!isValid || connectMut.isPending}
            className={`py-4 rounded-xl items-center mt-2 ${
              isValid ? 'bg-primary' : 'bg-slate-200'
            }`}
          >
            {connectMut.isPending
              ? <ActivityIndicator color="white" />
              : <Text className={`font-bold ${isValid ? 'text-white' : 'text-slate-400'}`}>
                  Hubungkan & Test Koneksi
                </Text>}
          </TouchableOpacity>
        </View>

        <View className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <Text className="text-xs font-semibold text-blue-700 mb-1">ℹ️ Keamanan</Text>
          <Text className="text-xs text-blue-600 leading-4">
            Password disimpan terenkripsi di database lokal kamu sendiri. Sistem hanya membaca email — tidak pernah kirim, hapus, atau modifikasi email apapun.
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}

// ─── Email Messages View ──────────────────────────────────────────────────────
function EmailMessagesView({ integrationId, onBack }: {
  integrationId: string | null
  onBack: () => void
}) {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [page] = useState(1)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['email-messages', integrationId, statusFilter, page],
    queryFn: () => emailApi.listMessages({
      integrationId: integrationId ?? undefined,
      status: statusFilter || undefined,
      page,
    }).then(r => r.data),
  })

  const reprocessMut = useMutation({
    mutationFn: (id: string) => emailApi.reprocess(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-messages'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })

  const STATUS_FILTERS = [
    { value: '', label: 'Semua' },
    { value: 'imported', label: '✅ Imported' },
    { value: 'pending', label: '⏳ Pending' },
    { value: 'skipped', label: '⏭️ Skipped' },
    { value: 'failed', label: '❌ Failed' },
  ]

  const messages = data?.data ?? []

  return (
    <View className="flex-1">
      <View className="bg-white border-b border-slate-100 px-5 pt-4 pb-3">
        <PageHeader title="Email Masuk" onBack={onBack} />
        {/* Status filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
          <View className="flex-row gap-2 pb-1">
            {STATUS_FILTERS.map(f => (
              <TouchableOpacity
                key={f.value}
                onPress={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-full border ${
                  statusFilter === f.value
                    ? 'bg-primary border-primary'
                    : 'bg-white border-slate-200'
                }`}
              >
                <Text className={`text-xs font-medium ${
                  statusFilter === f.value ? 'text-white' : 'text-slate-600'
                }`}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {isLoading ? (
        <ActivityIndicator className="my-8" />
      ) : messages.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <Inbox size={48} color="#cbd5e1" />
          <Text className="text-slate-400 mt-4 text-sm text-center">
            {statusFilter
              ? `Tidak ada email dengan status "${statusFilter}"`
              : 'Belum ada email yang diproses.\nTap "Sync Sekarang" untuk mulai scan inbox.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        >
          {messages.map((msg) => (
            <View key={msg.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
              {/* Status + bank */}
              <View className="flex-row items-center justify-between mb-2">
                <StatusBadge status={msg.parseStatus} />
                {msg.parsedBank && (
                  <Text className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                    {msg.parsedBank}
                  </Text>
                )}
              </View>

              {/* Subject */}
              <Text className="text-sm font-semibold text-slate-800 mb-1" numberOfLines={2}>
                {msg.subject}
              </Text>
              <Text className="text-xs text-slate-400 mb-2">
                {msg.from} · {new Date(msg.receivedAt).toLocaleString('id-ID')}
              </Text>

              {/* Transaction info if imported */}
              {msg.parseStatus === 'imported' && msg.parsedAmount && (
                <View className="bg-green-50 rounded-xl p-3 mb-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-green-700">
                      {msg.parsedType === 'income' ? '↓ Masuk' : '↑ Keluar'}
                      {msg.parsedMerchant ? ` · ${msg.parsedMerchant}` : ''}
                    </Text>
                    <Text className="text-sm font-bold text-green-700">
                      Rp {msg.parsedAmount.toLocaleString('id-ID')}
                    </Text>
                  </View>
                </View>
              )}

              {/* Error/skip reason */}
              {(msg.parseError || msg.skipReason) && (
                <View className="bg-slate-50 rounded-xl p-2 mb-2">
                  <Text className="text-xs text-slate-500">
                    {msg.parseError || msg.skipReason}
                  </Text>
                </View>
              )}

              {/* Reprocess button for failed/skipped */}
              {(msg.parseStatus === 'failed' || msg.parseStatus === 'skipped') && (
                <TouchableOpacity
                  onPress={() => reprocessMut.mutate(msg.id)}
                  disabled={reprocessMut.isPending}
                  className="flex-row items-center justify-center py-2 bg-blue-50 rounded-xl"
                >
                  <RotateCcw size={14} color="#3b82f6" />
                  <Text className="text-xs font-semibold text-blue-600 ml-1.5">Coba Import Ulang</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

// ─── Small reusable components ────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; bg: string; label: string }> = {
    imported: { color: '#16a34a', bg: '#f0fdf4', label: '✅ Imported' },
    pending:  { color: '#d97706', bg: '#fffbeb', label: '⏳ Pending' },
    skipped:  { color: '#64748b', bg: '#f8fafc', label: '⏭️ Skipped' },
    failed:   { color: '#dc2626', bg: '#fef2f2', label: '❌ Failed' },
  }
  const c = config[status] ?? config.pending
  return (
    <View style={{ backgroundColor: c.bg }} className="px-2 py-1 rounded-full">
      <Text style={{ color: c.color }} className="text-xs font-semibold">{c.label}</Text>
    </View>
  )
}

function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View className="flex-row items-center mb-5">
      <TouchableOpacity onPress={onBack} className="mr-3 w-8 h-8 items-center justify-center">
        <ArrowLeft size={22} color="#1e293b" />
      </TouchableOpacity>
      <Text className="text-xl font-bold text-slate-900">{title}</Text>
    </View>
  )
}

function FormField({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-semibold text-slate-500 mb-1.5">{label}</Text>
      <TextInput
        className="border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800"
        placeholderTextColor="#94a3b8"
        {...props}
      />
    </View>
  )
}

