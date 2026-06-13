import React, { useState, useEffect } from 'react'
import { router } from 'expo-router'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
  Platform,
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  aiUsed: boolean
  aiRawResult?: { type?: string; amount?: string; merchant?: string; category?: string }
}

// ─── API helpers ─────────────────────────────────────────────────────────────
const emailApi = {
  listIntegrations: () => api.get<EmailIntegration[]>('/email-integrations'),
  getGmailAuthUrl: () => api.get<{ url: string }>('/email-integrations/gmail/auth'),
  disconnect: (id: string) => api.delete(`/email-integrations/${id}`),
  toggle: (id: string) => api.patch(`/email-integrations/${id}/toggle`),
  sync: (id: string) => api.post(`/email-integrations/${id}/sync`),
  listMessages: (params?: { integrationId?: string; status?: string; page?: number; aiUsed?: boolean }) =>
    api.get<{ data: EmailMessage[]; total: number; page: number }>('/email-messages', { params }),
  reprocess: (id: string) => api.post(`/email-messages/${id}/reprocess`),
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function EmailIntegrationScreen() {
  const [view, setView] = useState<'list' | 'add-gmail' | 'messages'>('list')
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const qc = useQueryClient()

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
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      {/* Toast notification */}
      {toast && (
        <TouchableOpacity
          onPress={() => setToast(null)}
          className="mx-4 mt-3 p-3 rounded-xl flex-row items-center"
          style={toast.type === 'success'
            ? { backgroundColor: '#DEE8D7', borderWidth: 1, borderColor: '#C2D4B9' }
            : { backgroundColor: 'rgba(198,107,107,0.1)', borderWidth: 1, borderColor: '#C66B6B' }}
        >
          <Text style={{ fontSize: 16, marginRight: 8 }}>
            {toast.type === 'success' ? '✅' : '❌'}
          </Text>
          <Text className="text-sm font-medium flex-1" style={{ color: toast.type === 'success' ? '#41594F' : '#C66B6B' }}>
            {toast.msg}
          </Text>
        </TouchableOpacity>
      )}

      {view === 'list' && (
        <IntegrationList
          onAddGmail={() => setView('add-gmail')}
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
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const { data: integrationsRaw, isLoading, refetch } = useQuery({
    queryKey: ['email-integrations'],
    queryFn: () => emailApi.listIntegrations().then(r => r.data),
  })
  const integrations: EmailIntegration[] = Array.isArray(integrationsRaw)
    ? integrationsRaw
    : (integrationsRaw as any)?.data ?? []

  const showNotice = (type: 'success' | 'error', msg: string) => {
    setNotice({ type, msg })
    setTimeout(() => setNotice(null), 3500)
  }

  const syncMut = useMutation({
    mutationFn: (id: string) => emailApi.sync(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-integrations'] })
      qc.invalidateQueries({ queryKey: ['email-messages'] })
      showNotice('success', 'Sync dimulai — cek tab Pesan dalam beberapa saat.')
    },
    onError: () => showNotice('error', 'Gagal sync. Cek koneksi IMAP/Gmail.'),
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
    if (Platform.OS === 'web') {
      if (window.confirm(`Hapus koneksi dengan ${email}?\nEmail yang sudah diimport tidak terpengaruh.`)) {
        deleteMut.mutate(id)
      }
      return
    }
    Alert.alert('Hapus Koneksi', `Hapus koneksi dengan ${email}?\nEmail yang sudah diimport tidak terpengaruh.`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => deleteMut.mutate(id) },
    ])
  }

  return (
    <ScrollView
      className="flex-1"
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      <View className="p-5">
        {/* Inline notice banner */}
        {notice && (
          <View
            className="rounded-xl p-3 mb-3 flex-row items-center"
            style={notice.type === 'success'
              ? { backgroundColor: '#DEE8D7', borderWidth: 1, borderColor: '#C2D4B9' }
              : { backgroundColor: 'rgba(198,107,107,0.1)', borderWidth: 1, borderColor: '#C66B6B' }}
          >
            <Text style={{ fontSize: 15, marginRight: 8 }}>
              {notice.type === 'success' ? '✅' : '❌'}
            </Text>
            <Text style={{ fontSize: 13, flex: 1, color: notice.type === 'success' ? '#41594F' : '#C66B6B', fontWeight: '600' }}>
              {notice.msg}
            </Text>
          </View>
        )}
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center mb-4 self-start"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ fontSize: 22, color: '#6B8E6B', lineHeight: 26 }}>‹</Text>
          <Text className="text-sm font-semibold ml-1.5" style={{ color: '#6B8E6B' }}>Kembali</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-ink-900 mb-2">Integrasi Email</Text>
        <Text className="text-sm text-ink-500 mb-6">
          Hubungkan email untuk auto-import transaksi dari notifikasi bank & e-wallet
        </Text>

        {/* Connected integrations */}
        {isLoading ? (
          <ActivityIndicator color="#6B8E6B" style={{ marginVertical: 32 }} />
        ) : integrations?.length === 0 ? (
          <View className="bg-white rounded-2xl p-8 items-center shadow-sm mb-6">
            <View className="w-16 h-16 bg-primary/10 rounded-full items-center justify-center mb-4">
              <Text style={{ fontSize: 32 }}>✉️</Text>
            </View>
            <Text className="text-base font-semibold text-ink-700 mb-2">Belum ada email terhubung</Text>
            <Text className="text-sm text-ink-400 text-center">
              Hubungkan Gmail atau email lain untuk otomatis import transaksi dari BRI, BCA, GoPay, dll.
            </Text>
          </View>
        ) : (
          <View className="mb-6">
            {integrations?.map(integ => (
              <View key={integ.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
                {/* Header row */}
                <View className="flex-row items-center mb-2">
                  <View className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                    style={{ backgroundColor: integ.provider === 'gmail' ? 'rgba(198,107,107,0.1)' : '#DEE8D7' }}>
                    <Text style={{ fontSize: 20 }}>{integ.provider === 'gmail' ? '✉️' : '🖥'}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-ink-800">{integ.email}</Text>
                    <Text className="text-xs text-ink-400">
                      {integ.provider === 'gmail' ? 'Gmail OAuth' : `IMAP · ${integ.imapHost}`}
                    </Text>
                  </View>
                  {/* Status badge */}
                  <View className="px-2 py-1 rounded-full flex-row items-center"
                    style={{ backgroundColor: integ.isActive ? '#DEE8D7' : '#F4EEE3' }}>
                    <Text style={{ fontSize: 11 }}>{integ.isActive ? '🟢' : '⚫'}</Text>
                    <Text className="text-xs ml-1 font-semibold" style={{ color: integ.isActive ? '#41594F' : '#A8A39B' }}>
                      {integ.isActive ? 'Aktif' : 'Nonaktif'}
                    </Text>
                  </View>
                </View>

                {/* Last sync info — always visible */}
                <View className="flex-row items-center mb-3 px-1">
                  <Text style={{ fontSize: 11, color: '#A8A39B', marginRight: 4 }}>🕐</Text>
                  <Text style={{ fontSize: 11, color: integ.lastSyncAt ? '#8E887F' : '#A8A39B' }}>
                    {integ.lastSyncAt
                      ? `Sync terakhir: ${new Date(integ.lastSyncAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}`
                      : 'Belum pernah sync — tap Sync Sekarang'}
                  </Text>
                </View>

                {/* Actions: sync + lihat email */}
                <View className="flex-row gap-2 mb-2">
                  <TouchableOpacity
                    onPress={() => syncMut.mutate(integ.id)}
                    disabled={!integ.isActive || syncMut.isPending}
                    className="flex-1 py-2.5 rounded-xl flex-row items-center justify-center"
                    style={{ backgroundColor: integ.isActive ? '#6B8E6B' : '#F4EEE3' }}
                  >
                    {syncMut.isPending
                      ? <ActivityIndicator size="small" color="white" />
                      : <Text style={{ fontSize: 13, marginRight: 4, color: integ.isActive ? 'white' : '#A8A39B' }}>↻</Text>}
                    <Text style={{ fontSize: 12, fontWeight: '700', color: integ.isActive ? 'white' : '#A8A39B' }}>
                      Sync Sekarang
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => onViewMessages(integ.id)}
                    className="flex-1 py-2.5 rounded-xl flex-row items-center justify-center"
                    style={{ backgroundColor: '#EEF4EE' }}
                  >
                    <Text style={{ fontSize: 13, marginRight: 4 }}>📥</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B8E6B' }}>Lihat Email</Text>
                  </TouchableOpacity>
                </View>

                {/* Secondary actions: toggle + delete */}
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => toggleMut.mutate(integ.id)}
                    disabled={toggleMut.isPending}
                    className="flex-1 py-2 rounded-xl flex-row items-center justify-center"
                    style={{ backgroundColor: '#F4EEE3', borderWidth: 1, borderColor: '#E0DBD2' }}
                  >
                    <Text style={{ fontSize: 12, marginRight: 4 }}>{integ.isActive ? '⏸' : '▶️'}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#55504A' }}>
                      {integ.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDelete(integ.id, integ.email)}
                    disabled={deleteMut.isPending}
                    className="flex-1 py-2 rounded-xl flex-row items-center justify-center"
                    style={{ backgroundColor: 'rgba(198,107,107,0.08)', borderWidth: 1, borderColor: 'rgba(198,107,107,0.25)' }}
                  >
                    <Text style={{ fontSize: 12, marginRight: 4 }}>🗑</Text>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#C66B6B' }}>Hapus Koneksi</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Add buttons */}
        <Text className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-3">
          Tambah Integrasi Baru
        </Text>

        {/* Gmail */}
        <TouchableOpacity
          onPress={onAddGmail}
          className="bg-white rounded-2xl p-4 mb-3 shadow-sm flex-row items-center"
        >
          <View className="w-12 h-12 rounded-xl items-center justify-center mr-4"
            style={{ backgroundColor: 'rgba(198,107,107,0.1)' }}>
            <Text style={{ fontSize: 24 }}>✉️</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-ink-800">Hubungkan Gmail</Text>
            <Text className="text-xs text-ink-400 mt-0.5">Login dengan Google — paling mudah</Text>
          </View>
          <Text style={{ fontSize: 18, color: '#A8A39B' }}>›</Text>
        </TouchableOpacity>

        {/* IMAP */}
        <TouchableOpacity
          onPress={onAddIMAP}
          className="bg-white rounded-2xl p-4 mb-3 shadow-sm flex-row items-center"
        >
          <View className="w-12 h-12 bg-primary/10 rounded-xl items-center justify-center mr-4">
            <Text style={{ fontSize: 24 }}>🖥</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-ink-800">Hubungkan via IMAP</Text>
            <Text className="text-xs text-ink-400 mt-0.5">Outlook, Yahoo, atau email lain</Text>
          </View>
          <Text style={{ fontSize: 18, color: '#A8A39B' }}>›</Text>
        </TouchableOpacity>

        {/* Info box */}
        <View style={{ backgroundColor: '#DEE8D7', borderWidth: 1, borderColor: '#C2D4B9', borderRadius: 16, padding: 16, marginTop: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#2F4338', marginBottom: 8 }}>Bank & E-Wallet yang Didukung</Text>
          <Text style={{ fontSize: 12, color: '#41594F', lineHeight: 18 }}>
            BCA · Mandiri · BRI · BNI · GoPay · OVO · DANA · ShopeePay · Jenius · Livin' · BSI · CIMB · Permata · Flip · LinkAja · Danamon · BTN
          </Text>
          <Text style={{ fontSize: 12, color: '#547254', marginTop: 8 }}>
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
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.location.href = data.url
      } else {
        // Android/iOS: in-app browser OAuth
        await WebBrowser.openAuthSessionAsync(data.url, 'fintrackr://')
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
            <View className="w-20 h-20 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(198,107,107,0.1)' }}>
              <Text style={{ fontSize: 40 }}>✉️</Text>
            </View>
            <Text className="text-lg font-bold text-ink-800 mb-2">Login dengan Google</Text>
            <Text className="text-sm text-ink-500 text-center leading-5">
              Izinkan FinTrackr membaca email notifikasi transaksi dari inbox Gmail kamu.
              Kami hanya membaca email — tidak bisa kirim atau hapus.
            </Text>
          </View>

          {/* Steps */}
          <View className="bg-canvas-200 rounded-xl p-4 mb-5">
            <Text className="text-xs font-semibold text-ink-600 mb-3">Cara kerjanya:</Text>
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
                <Text className="text-sm text-ink-600 flex-1">{step}</Text>
              </View>
            ))}
          </View>

          {error ? (
            <View style={{ backgroundColor: 'rgba(198,107,107,0.1)', borderWidth: 1, borderColor: '#C66B6B', borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>⚠️</Text>
              <Text style={{ fontSize: 13, color: '#C66B6B', flex: 1 }}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleConnect}
            disabled={loading}
            className="py-4 rounded-xl flex-row items-center justify-center"
            style={{ backgroundColor: '#C66B6B' }}
          >
            {loading
              ? <ActivityIndicator color="white" />
              : <>
                  <Text style={{ fontSize: 18, marginRight: 8 }}>✉️</Text>
                  <Text className="text-white font-bold text-base">Login dengan Google</Text>
                </>}
          </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: '#FBEFD2', borderWidth: 1, borderColor: '#D9A441', borderRadius: 16, padding: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#8C6B1F', marginBottom: 4 }}>⚠️ Perlu Google OAuth</Text>
          <Text style={{ fontSize: 12, color: '#8C6B1F', lineHeight: 16 }}>
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
  const [formError, setFormError] = useState('')

  const PRESETS: Record<string, { host: string; port: string; label: string; icon: string }> = {
    gmail:   { host: 'imap.gmail.com',        port: '993', label: 'Gmail',   icon: '✉️' },
    outlook: { host: 'outlook.office365.com', port: '993', label: 'Outlook', icon: '📧' },
    yahoo:   { host: 'imap.mail.yahoo.com',   port: '993', label: 'Yahoo',   icon: '📨' },
  }

  const applyPreset = (key: string) => {
    setPreset(key)
    setFormError('')
    setForm(f => ({ ...f, host: PRESETS[key].host, imapHost: PRESETS[key].host, imapPort: PRESETS[key].port, imapUser: f.email }))
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
      onSuccess()
    },
    onError: (e: any) => {
      setFormError(e.response?.data?.error || e.response?.data?.message || 'Tidak bisa terhubung ke server IMAP. Periksa host, port, dan password.')
    },
  })

  const isValid = form.email && form.imapHost && form.imapPort && form.imapPassword
  const showGmailHint = preset === 'gmail' || form.imapHost.includes('gmail')

  return (
    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
      <View className="p-5">
        <PageHeader title="Hubungkan via IMAP" onBack={onBack} />

        {/* Provider presets */}
        <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#8E887F', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Pilih Provider
          </Text>
          <View className="flex-row gap-2">
            {Object.entries(PRESETS).map(([key, p]) => (
              <TouchableOpacity
                key={key}
                onPress={() => applyPreset(key)}
                style={{
                  flex: 1, paddingVertical: 10, paddingHorizontal: 8,
                  borderRadius: 12, borderWidth: 1.5, alignItems: 'center',
                  backgroundColor: preset === key ? '#6B8E6B' : '#FAF7F2',
                  borderColor: preset === key ? '#6B8E6B' : '#E0DBD2',
                }}
              >
                <Text style={{ fontSize: 20, marginBottom: 4 }}>{p.icon}</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: preset === key ? 'white' : '#55504A' }}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => { setPreset('manual'); setFormError('') }}
              style={{
                flex: 1, paddingVertical: 10, paddingHorizontal: 8,
                borderRadius: 12, borderWidth: 1.5, alignItems: 'center',
                backgroundColor: preset === 'manual' ? '#6B8E6B' : '#FAF7F2',
                borderColor: preset === 'manual' ? '#6B8E6B' : '#E0DBD2',
              }}
            >
              <Text style={{ fontSize: 20, marginBottom: 4 }}>⚙️</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: preset === 'manual' ? 'white' : '#55504A' }}>
                Manual
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Form */}
        <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <FormField
            label="Alamat Email"
            placeholder="kamu@gmail.com"
            value={form.email}
            onChangeText={(v) => { setFormError(''); setForm(f => ({ ...f, email: v, imapUser: v })) }}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <FormField
            label="IMAP Host"
            placeholder="imap.gmail.com"
            value={form.imapHost}
            onChangeText={(v) => { setFormError(''); setForm(f => ({ ...f, imapHost: v })) }}
            autoCapitalize="none"
          />

          <View className="flex-row gap-3">
            <View style={{ width: 100 }}>
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

          {/* Password field */}
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#8E887F', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            Password / App Password
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            borderWidth: 1, borderColor: '#E0DBD2', borderRadius: 12,
            paddingHorizontal: 12, marginBottom: 12, backgroundColor: '#FAF7F2',
          }}>
            <TextInput
              style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: '#2D2A26' }}
              placeholder="App password dari Google/provider"
              placeholderTextColor="#A8A39B"
              value={form.imapPassword}
              onChangeText={(v) => { setFormError(''); setForm(f => ({ ...f, imapPassword: v })) }}
              secureTextEntry={!showPass}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPass(s => !s)} style={{ padding: 4 }}>
              <Text style={{ fontSize: 16, color: '#A8A39B' }}>{showPass ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>

          {/* Gmail App Password hint */}
          {showGmailHint && (
            <View style={{ backgroundColor: '#FBEFD2', borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#8C6B1F', marginBottom: 4 }}>
                ⚠️ Gmail: Gunakan App Password
              </Text>
              <Text style={{ fontSize: 12, color: '#8C6B1F', lineHeight: 18 }}>
                Gmail tidak mengizinkan password biasa via IMAP.{'\n'}
                Buat App Password di: myaccount.google.com → Security → 2-Step Verification → App Passwords
              </Text>
            </View>
          )}

          {/* Inline error */}
          {formError ? (
            <View style={{
              flexDirection: 'row', alignItems: 'flex-start',
              backgroundColor: 'rgba(198,107,107,0.08)', borderRadius: 12,
              borderWidth: 1, borderColor: 'rgba(198,107,107,0.3)',
              padding: 12, marginBottom: 12,
            }}>
              <Text style={{ fontSize: 15, marginRight: 8 }}>⚠️</Text>
              <Text style={{ fontSize: 13, color: '#C66B6B', flex: 1, lineHeight: 18 }}>{formError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={() => connectMut.mutate()}
            disabled={!isValid || connectMut.isPending}
            style={{
              paddingVertical: 14, borderRadius: 12, alignItems: 'center',
              backgroundColor: isValid ? '#6B8E6B' : '#F4EEE3',
            }}
          >
            {connectMut.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, marginRight: 8 }}>🔌</Text>
                <Text style={{ fontWeight: '700', fontSize: 15, color: isValid ? 'white' : '#A8A39B' }}>
                  Hubungkan & Test Koneksi
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Security note */}
        <View style={{ backgroundColor: '#DEE8D7', borderWidth: 1, borderColor: '#C2D4B9', borderRadius: 16, padding: 16, marginBottom: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#2F4338', marginBottom: 6 }}>🔒 Keamanan</Text>
          <Text style={{ fontSize: 12, color: '#41594F', lineHeight: 18 }}>
            Password disimpan terenkripsi di database lokal kamu sendiri.{'\n'}
            Sistem hanya <Text style={{ fontWeight: '700' }}>membaca</Text> email — tidak pernah kirim, hapus, atau modifikasi email apapun.
          </Text>
        </View>

        {/* Polling info */}
        <View style={{ backgroundColor: '#FAF7F2', borderWidth: 1, borderColor: '#E0DBD2', borderRadius: 16, padding: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#55504A', marginBottom: 4 }}>ℹ️ Polling Otomatis</Text>
          <Text style={{ fontSize: 12, color: '#8E887F', lineHeight: 18 }}>
            Setelah terhubung, sistem scan inbox setiap <Text style={{ fontWeight: '700' }}>10 menit</Text> untuk email transaksi baru.
            Kamu juga bisa tap "Sync Sekarang" kapan saja.
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
  const [aiFilter, setAiFilter] = useState(false)
  const [page] = useState(1)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['email-messages', integrationId, statusFilter, aiFilter, page],
    queryFn: () => emailApi.listMessages({
      integrationId: integrationId ?? undefined,
      status: statusFilter || undefined,
      aiUsed: aiFilter ? true : undefined,
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
      <View className="bg-white px-5 pt-4 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: '#ECE4D3' }}>
        <PageHeader title="Email Masuk" onBack={onBack} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
          <View className="flex-row gap-2 pb-1">
            {STATUS_FILTERS.map(f => (
              <TouchableOpacity
                key={f.value}
                onPress={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-full border ${
                  statusFilter === f.value
                    ? 'bg-primary border-primary'
                    : 'bg-white border-border'
                }`}
              >
                <Text className={`text-xs font-medium ${
                  statusFilter === f.value ? 'text-white' : 'text-ink-600'
                }`}>{f.label}</Text>
              </TouchableOpacity>
            ))}
            {/* AI filter toggle — independent of status filter */}
            <TouchableOpacity
              onPress={() => setAiFilter(f => !f)}
              style={{
                paddingHorizontal: 12, paddingVertical: 6,
                borderRadius: 999, borderWidth: 1,
                backgroundColor: aiFilter ? '#7C3AED' : 'white',
                borderColor: aiFilter ? '#7C3AED' : '#E0DBD2',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: aiFilter ? 'white' : '#55504A' }}>
                🤖 AI
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#6B8E6B" style={{ marginTop: 32 }} />
      ) : messages.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <Text style={{ fontSize: 48 }}>📥</Text>
          <Text className="text-ink-400 mt-4 text-sm text-center">
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
                  <Text className="text-xs font-semibold text-ink-500 bg-canvas-200 px-2 py-1 rounded-lg">
                    {msg.parsedBank}
                  </Text>
                )}
              </View>

              {/* AI badge */}
              {msg.aiUsed && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <View style={{
                    backgroundColor: '#EDE9FE', borderRadius: 999,
                    paddingHorizontal: 8, paddingVertical: 2, marginRight: 8,
                  }}>
                    <Text style={{ fontSize: 11, color: '#7C3AED', fontWeight: '700' }}>🤖 AI</Text>
                  </View>
                  {msg.aiRawResult?.merchant ? (
                    <Text style={{ fontSize: 12, color: '#8E887F' }}>
                      → {msg.aiRawResult.merchant}
                    </Text>
                  ) : null}
                </View>
              )}

              {/* Subject */}
              <Text className="text-sm font-semibold text-ink-800 mb-1" numberOfLines={2}>
                {msg.subject}
              </Text>
              <Text className="text-xs text-ink-400 mb-2">
                {msg.from} · {new Date(msg.receivedAt).toLocaleString('id-ID')}
              </Text>

              {/* Transaction info if imported */}
              {msg.parseStatus === 'imported' && msg.parsedAmount && (
                <View className="bg-primary-50 rounded-xl p-3 mb-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-primary-700">
                      {msg.parsedType === 'income' ? '↓ Masuk' : '↑ Keluar'}
                      {msg.parsedMerchant ? ` · ${msg.parsedMerchant}` : ''}
                    </Text>
                    <Text className="text-sm font-bold text-primary-700">
                      Rp {msg.parsedAmount.toLocaleString('id-ID')}
                    </Text>
                  </View>
                </View>
              )}

              {/* Error/skip reason */}
              {(msg.parseError || msg.skipReason) && (
                <View className="bg-canvas-200 rounded-xl p-2 mb-2">
                  <Text className="text-xs text-ink-500">
                    {msg.parseError || msg.skipReason}
                  </Text>
                </View>
              )}

              {/* Reprocess button for failed/skipped */}
              {(msg.parseStatus === 'failed' || msg.parseStatus === 'skipped') && (
                <TouchableOpacity
                  onPress={() => reprocessMut.mutate(msg.id)}
                  disabled={reprocessMut.isPending}
                  className="flex-row items-center justify-center py-2 bg-primary/10 rounded-xl"
                >
                  <Text style={{ fontSize: 14, marginRight: 6 }}>↺</Text>
                  <Text className="text-xs font-semibold text-primary">Coba Import Ulang</Text>
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
    imported: { color: '#41594F', bg: '#DEE8D7',  label: '✅ Imported' },
    pending:  { color: '#8C6B1F', bg: '#FBEFD2',  label: '⏳ Pending' },
    skipped:  { color: '#6F6A63', bg: '#F4EEE3',  label: '⏭️ Skipped' },
    failed:   { color: '#C66B6B', bg: 'rgba(198,107,107,0.1)', label: '❌ Failed' },
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
        <Text style={{ fontSize: 22, color: '#2D2A26', lineHeight: 26 }}>←</Text>
      </TouchableOpacity>
      <Text className="text-xl font-bold text-ink-900">{title}</Text>
    </View>
  )
}

function FormField({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-semibold text-ink-500 mb-1.5">{label}</Text>
      <TextInput
        className="border border-border rounded-xl px-3 py-3 text-sm text-ink-800"
        style={{ backgroundColor: '#FAF7F2' }}
        placeholderTextColor="#A8A39B"
        {...props}
      />
    </View>
  )
}
