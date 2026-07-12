import React, { useState, useEffect } from 'react'
import { router } from 'expo-router'
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  RefreshControl, Alert, Platform, TextInput, Modal,
} from 'react-native'
import { Mail, Monitor, RefreshCw, Trash2, ArrowLeft } from 'lucide-react'
import * as WebBrowser from 'expo-web-browser'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../src/lib/api'
import { useIsProActive, useSubscription } from '../../src/hooks/useSubscription'
import { useTheme } from '../../src/lib/theme'

const KNOWN_BANKS = ['BCA', 'BRI', 'GoPay', 'Shopee', 'Mandiri', 'BNI', 'OVO', 'DANA', 'BSI', 'CIMB', 'Jenius', 'Permata', 'Flip', 'LinkAja', 'Danamon', 'BTN']

// ── Types ──────────────────────────────────────────────────────
interface EmailIntegration {
  id: string; email: string; provider: 'gmail'
  isActive: boolean; lastSyncAt: string | null
  createdAt: string
}

interface EmailMessage {
  id: string; subject: string; from: string; receivedAt: string
  parseStatus: 'pending' | 'imported' | 'skipped' | 'failed'
  parsedBank?: string; parsedType?: string; parsedAmount?: number
  parsedMerchant?: string; parseError?: string; skipReason?: string
  transactionId?: string; aiUsed: boolean
  aiRawResult?: { type?: string; amount?: string; merchant?: string; category?: string }
}

// ── API helpers ────────────────────────────────────────────────
const emailApi = {
  listIntegrations: () => api.get<EmailIntegration[]>('/email-integrations'),
  getGmailAuthUrl: () => api.get<{ url: string }>('/email-integrations/gmail/auth'),
  disconnect: (id: string) => api.delete(`/email-integrations/${id}`),
  toggle: (id: string) => api.patch(`/email-integrations/${id}/toggle`),
  sync: (id: string, sinceDate?: string) => api.post(`/email-integrations/${id}/sync`, sinceDate ? { sinceDate } : {}),
  listMessages: (params?: { integrationId?: string; status?: string; page?: number; limit?: number; aiUsed?: boolean }) =>
    api.get<{ data: EmailMessage[]; total: number; page: number }>('/email-messages', { params }),
  reprocess: (id: string) => api.post(`/email-messages/${id}/reprocess`),
}

// ── Main Screen ────────────────────────────────────────────────
export default function EmailIntegrationScreen() {
  const C = useTheme()
  const isPro = useIsProActive()
  const { isLoading: subLoading } = useSubscription()
  const [view, setView] = useState<'main' | 'add-gmail'>('main')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Date picker — shown after Gmail connects
  const [sincePicker, setSincePicker] = useState<{ email: string } | null>(null)
  const [sinceDate, setSinceDate] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  })
  const [syncLoading, setSyncLoading] = useState(false)
  const qc = useQueryClient()

  // Min = 25th of last month, Max = today
  const maxSinceDate = new Date().toISOString().split('T')[0]
  const minSinceDate = (() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() - 1, 25).toISOString().split('T')[0]
  })()

  const handleConnectSuccess = (email: string) => {
    setView('main')
    setSinceDate((() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0] })())
    setSincePicker({ email })
  }

  const handleConfirmSince = async () => {
    setSyncLoading(true)
    try {
      const { data } = await emailApi.listIntegrations()
      const list: EmailIntegration[] = Array.isArray(data) ? data : (data as any)?.data ?? []
      const integ = list.find(i => i.email === sincePicker?.email) ?? list[0]
      if (integ) await emailApi.sync(integ.id, sinceDate)
      qc.invalidateQueries({ queryKey: ['email-integrations'] })
      setSincePicker(null)
      setToast({ type: 'success', msg: `Mengambil email dari ${sinceDate} ✅` })
    } catch {
      setToast({ type: 'error', msg: 'Gagal mengatur tanggal sync.' })
    } finally {
      setSyncLoading(false)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const connected = sessionStorage.getItem('gmail_connected')
    const gmailError = sessionStorage.getItem('gmail_error')
    if (connected) {
      sessionStorage.removeItem('gmail_connected')
      handleConnectSuccess(connected)
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

  if (!subLoading && !isPro) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.cream, ...(Platform.OS === 'web' ? { height: '100vh' as any, overflow: 'hidden' as any } : {}) }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{ width: 72, height: 72, borderRadius: 999, backgroundColor: '#FBEFD2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 32 }}>🔒</Text>
          </View>
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#C97B5C', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'Inter_800ExtraBold', marginBottom: 6 }}>Fitur Pro</Text>
          <Text style={{ fontSize: 20, fontWeight: '900', color: C.fg1, fontFamily: 'Inter_900Black', textAlign: 'center', marginBottom: 8 }}>Integrasi Email</Text>
          <Text style={{ fontSize: 13, color: C.fg3, textAlign: 'center', lineHeight: 20, fontFamily: 'Inter_500Medium', marginBottom: 24 }}>
            {'This Feature only for Pro Member.\nAuto-import transaksi dari Gmail.'}
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/settings?section=billing' as any)}
            style={{ backgroundColor: C.primary, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 36, width: '100%', alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, fontFamily: 'Inter_800ExtraBold' }}>Lihat Paket Pro →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream, ...(Platform.OS === 'web' ? { height: '100vh' as any, overflow: 'hidden' as any } : {}) }} edges={['top']}>
      {/* ── Date picker modal ── */}
      <Modal visible={!!sincePicker} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: C.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: C.fg1, fontFamily: 'Inter_900Black', marginBottom: 6 }}>
              📅 Ambil email dari tanggal?
            </Text>
            <Text style={{ fontSize: 13, color: C.fg3, fontFamily: 'Inter_500Medium', lineHeight: 18, marginBottom: 16 }}>
              <Text style={{ fontWeight: '700', color: C.fg2 }}>{sincePicker?.email}</Text> berhasil terhubung!{'\n'}
              Pilih tanggal awal. Default 7 hari lalu. Bisa pilih dari tanggal 25 bulan lalu sampai hari ini.
            </Text>

            {Platform.OS === 'web' ? (
              <>
                {/* Inject CSS so out-of-range dates are visually greyed and non-interactive */}
                <style>{`
                  input[type="date"].saku-date::-webkit-calendar-picker-indicator { cursor: pointer; }
                  input[type="date"].saku-date:out-of-range { color: #A8A39B; text-decoration: line-through; }
                  input[type="date"].saku-date[data-outofrange="true"] { border-color: #C66B6B; background-color: #FFF0F0; }
                `}</style>
                <input
                  type="date"
                  className="saku-date"
                  value={sinceDate}
                  min={minSinceDate}
                  max={maxSinceDate}
                  data-outofrange={sinceDate < minSinceDate || sinceDate > maxSinceDate ? 'true' : 'false'}
                  onClick={e => (e.target as HTMLInputElement).showPicker?.()}
                  onChange={e => {
                    const v = e.target.value
                    if (!v) return
                    // Hard-clamp: if user somehow picks out-of-range, snap to nearest boundary
                    if (v < minSinceDate) { setSinceDate(minSinceDate); return }
                    if (v > maxSinceDate) { setSinceDate(maxSinceDate); return }
                    setSinceDate(v)
                  }}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 12,
                    border: '1.5px solid #E0DBD2', fontSize: 15, marginBottom: 4,
                    backgroundColor: '#FAF7F2', fontFamily: 'inherit', color: '#2D2A26',
                    boxSizing: 'border-box', cursor: 'pointer',
                  } as any}
                />
                {/* Range hint shown below the picker */}
                <Text style={{ fontSize: 11, color: C.fg4, fontFamily: 'Inter_500Medium', marginBottom: 16 }}>
                  Rentang yang diizinkan: {minSinceDate} s/d {maxSinceDate}
                </Text>
              </>
            ) : (
              <>
                <TextInput
                  value={sinceDate}
                  onChangeText={v => {
                    if (!v) return
                    if (v < minSinceDate) { setSinceDate(minSinceDate); return }
                    if (v > maxSinceDate) { setSinceDate(maxSinceDate); return }
                    setSinceDate(v)
                  }}
                  placeholder={`YYYY-MM-DD (${minSinceDate} s/d ${maxSinceDate})`}
                  placeholderTextColor={C.fg4}
                  style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: 12, padding: 12, marginBottom: 4, fontSize: 14, color: C.fg1 }}
                />
                <Text style={{ fontSize: 11, color: C.fg4, marginBottom: 16 }}>
                  Rentang yang diizinkan: {minSinceDate} s/d {maxSinceDate}
                </Text>
              </>
            )}

            <TouchableOpacity
              onPress={handleConfirmSince}
              disabled={syncLoading}
              style={{ backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 }}
            >
              {syncLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, fontFamily: 'Inter_800ExtraBold' }}>Mulai Ambil Email →</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setSincePicker(null); setToast({ type: 'success', msg: `${sincePicker?.email} terhubung!` }) }}>
              <Text style={{ textAlign: 'center', color: C.fg3, fontSize: 13, fontFamily: 'Inter_500Medium' }}>Lewati, atur nanti</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {toast && (
        <TouchableOpacity
          onPress={() => setToast(null)}
          style={{
            marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 12,
            flexDirection: 'row', alignItems: 'center', gap: 8,
            ...(toast.type === 'success'
              ? { backgroundColor: C.primarySoft, borderWidth: 1, borderColor: '#C2D4B9' }
              : { backgroundColor: C.dangerSoft, borderWidth: 1, borderColor: C.danger }),
          }}
        >
          <Text style={{ fontSize: 15 }}>{toast.type === 'success' ? '✅' : '❌'}</Text>
          <Text style={{ fontSize: 13, flex: 1, fontWeight: '600', color: toast.type === 'success' ? C.heroEnd : C.danger, fontFamily: 'Inter_600SemiBold' }}>
            {toast.msg}
          </Text>
        </TouchableOpacity>
      )}
      {view === 'main' && (
        <EmailMainView
          onAddGmail={() => setView('add-gmail')}
        />
      )}
      {view === 'add-gmail' && (
        <ConnectGmailView onBack={() => setView('main')} onSuccess={() => setView('main')} />
      )}
    </SafeAreaView>
  )
}

// ── Unified Main View ──────────────────────────────────────────
function EmailMainView({ onAddGmail }: { onAddGmail: () => void }) {
  const C = useTheme()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const { data: integrationsRaw, isLoading: intLoading, refetch: refetchInt } = useQuery({
    queryKey: ['email-integrations'],
    queryFn: () => emailApi.listIntegrations().then(r => r.data),
  })
  const integrations: EmailIntegration[] = Array.isArray(integrationsRaw)
    ? integrationsRaw
    : (integrationsRaw as any)?.data ?? []

  const { data: totalData } = useQuery({
    queryKey: ['email-stats-total'],
    queryFn: () => emailApi.listMessages({ page: 1, limit: 1 }).then(r => r.data),
    staleTime: 30_000,
  })
  const { data: importedData } = useQuery({
    queryKey: ['email-stats-imported'],
    queryFn: () => emailApi.listMessages({ status: 'imported', page: 1, limit: 1 }).then(r => r.data),
    staleTime: 30_000,
  })
  const { data: skippedData } = useQuery({
    queryKey: ['email-stats-skipped'],
    queryFn: () => emailApi.listMessages({ status: 'skipped', page: 1, limit: 1 }).then(r => r.data),
    staleTime: 30_000,
  })

  const totalCount = totalData?.total ?? 0
  const importedCount = importedData?.total ?? 0
  const skippedCount = skippedData?.total ?? 0

  const { data: messagesData, isLoading: msgLoading, refetch: refetchMsg } = useQuery({
    queryKey: ['email-messages', statusFilter],
    queryFn: () => emailApi.listMessages({ status: statusFilter || undefined, limit: 30 }).then(r => r.data),
    staleTime: 30_000,
  })
  const messages = messagesData?.data ?? []

  const syncMut = useMutation({
    mutationFn: (id: string) => emailApi.sync(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-integrations'] })
      qc.invalidateQueries({ queryKey: ['email-messages'] })
      qc.invalidateQueries({ queryKey: ['email-stats-total'] })
      qc.invalidateQueries({ queryKey: ['email-stats-imported'] })
      qc.invalidateQueries({ queryKey: ['email-stats-skipped'] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => emailApi.disconnect(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-integrations'] }),
  })

  const reprocessMut = useMutation({
    mutationFn: (id: string) => emailApi.reprocess(id),
    onSuccess: () => {
      // Use exact:false so ['email-messages'] matches ['email-messages', statusFilter]
      qc.invalidateQueries({ queryKey: ['email-messages'], exact: false })
      qc.invalidateQueries({ queryKey: ['email-stats-imported'] })
      qc.invalidateQueries({ queryKey: ['email-stats-skipped'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })

  // Track which specific message ID is being reprocessed so only that card shows loading
  const [reprocessingId, setReprocessingId] = useState<string | null>(null)

  const handleReprocess = (id: string) => {
    setReprocessingId(id)
    reprocessMut.mutate(id, {
      onSettled: () => setReprocessingId(null),
    })
  }

  const handleDelete = (id: string, email: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Hapus koneksi dengan ${email}?\nEmail yang sudah diimport tidak terpengaruh.`)) {
        deleteMut.mutate(id)
      }
      return
    }
    Alert.alert('Hapus Koneksi', `Hapus koneksi dengan ${email}?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => deleteMut.mutate(id) },
    ])
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refetchInt(), refetchMsg()])
    setRefreshing(false)
  }

  const formatLastSync = (s: string | null) => {
    if (!s) return 'Belum sync'
    const mins = Math.round((Date.now() - new Date(s).getTime()) / 60000)
    if (mins < 1) return 'Baru saja'
    if (mins < 60) return `Sync ${mins} mnt lalu`
    return `Sync ${Math.floor(mins / 60)} jam lalu`
  }

  const STATUS_FILTERS = [
    { value: '', label: 'Semua' },
    { value: 'imported', label: '✅ Import' },
    { value: 'skipped', label: '⏭ Lewat' },
    { value: 'failed', label: '❌ Gagal' },
  ]

  return (
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}>
        <View>
          <Text style={{ fontSize: 26, fontWeight: '900', color: C.fg1, fontFamily: 'Inter_900Black', letterSpacing: -0.5 }}>Email</Text>
          <Text style={{ fontSize: 13, color: C.fg3, marginTop: 2, fontFamily: 'Inter_500Medium' }}>Import otomatis dari bank</Text>
        </View>
        <TouchableOpacity
          onPress={onAddGmail}
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, gap: 5, marginTop: 4 }}
        >
          <Text style={{ color: '#fff', fontSize: 16, lineHeight: 18, fontWeight: '700' }}>+</Text>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13, fontFamily: 'Inter_800ExtraBold' }}>Hubungkan</Text>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 20 }}>
        <StatCard label="Email diproses" value={totalCount} valueColor="#3D7A56" bg="#F0FAF4" />
        <StatCard label="Diimport" value={importedCount} valueColor="#3D7A56" bg="#F0FAF4" />
        <StatCard label="Dilewati" value={skippedCount} valueColor="#E8A020" bg="#FEF9EE" />
      </View>

      {/* Akun Terhubung */}
      <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: C.fg1, fontFamily: 'Inter_800ExtraBold', marginBottom: 12 }}>
          Akun Terhubung
        </Text>

        {intLoading ? (
          <ActivityIndicator color={C.primary} style={{ marginVertical: 24 }} />
        ) : integrations.length === 0 ? (
          <View style={{
            backgroundColor: C.surface, borderRadius: 20, padding: 28, alignItems: 'center',
            shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
          }}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>✉️</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.fg2, textAlign: 'center', fontFamily: 'Inter_700Bold' }}>
              Belum ada email terhubung
            </Text>
            <Text style={{ fontSize: 12, color: C.fg3, marginTop: 4, textAlign: 'center', fontFamily: 'Inter_500Medium', lineHeight: 18 }}>
              Hubungkan Gmail untuk import{'\n'}otomatis dari BCA, BRI, GoPay, dan lainnya
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <TouchableOpacity
                onPress={onAddGmail}
                style={{ backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13, fontFamily: 'Inter_800ExtraBold' }}>✉️ Gmail</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          integrations.map(integ => (
            <View key={integ.id} style={{
              backgroundColor: C.surface, borderRadius: 20, padding: 16, marginBottom: 10,
              shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <View style={{
                  width: 42, height: 42, borderRadius: 14,
                  backgroundColor: integ.provider === 'gmail' ? C.accentSoft : C.primarySoft,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {integ.provider === 'gmail'
                    ? <Mail size={20} color={C.accent} strokeWidth={2} />
                    : <Monitor size={20} color={C.primary} strokeWidth={2} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.fg1, fontFamily: 'Inter_700Bold' }} numberOfLines={1}>
                    {integ.email}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: integ.isActive ? C.primary : C.fg4 }} />
                    <Text style={{ fontSize: 11, color: C.fg3, fontFamily: 'Inter_500Medium' }}>
                      {integ.isActive ? 'Aktif' : 'Nonaktif'} · {formatLastSync(integ.lastSyncAt)}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => syncMut.mutate(integ.id)}
                    disabled={!integ.isActive || syncMut.isPending}
                    style={{
                      width: 36, height: 36, borderRadius: 10,
                      backgroundColor: integ.isActive ? C.primarySoft : C.creamSunken,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {syncMut.isPending
                      ? <ActivityIndicator size="small" color={C.primary} />
                      : <RefreshCw size={16} color={integ.isActive ? C.primary : C.fg4} strokeWidth={2} />
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(integ.id, integ.email)}
                    style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Trash2 size={14} color={C.accent} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Bank tags */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {KNOWN_BANKS.slice(0, 4).map(bank => (
                  <View key={bank} style={{ backgroundColor: C.creamSunken, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: C.fg2, fontFamily: 'Inter_700Bold' }}>{bank}</Text>
                  </View>
                ))}
                <View style={{
                  backgroundColor: C.creamSunken, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
                  borderWidth: 1, borderStyle: 'dashed', borderColor: C.border,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.fg3, fontFamily: 'Inter_700Bold' }}>
                    +{KNOWN_BANKS.length - 4} bank
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Email Terakhir */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 100 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: C.fg1, fontFamily: 'Inter_800ExtraBold', marginBottom: 12 }}>
          Email Terakhir
        </Text>

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {STATUS_FILTERS.map(f => {
              const active = statusFilter === f.value
              return (
                <TouchableOpacity
                  key={f.value}
                  onPress={() => setStatusFilter(f.value)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                    backgroundColor: active ? C.primary : C.surface,
                    borderWidth: 1.5, borderColor: active ? C.primary : C.border,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : C.fg2, fontFamily: 'Inter_700Bold' }}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </ScrollView>

        {/* Message list */}
        {msgLoading ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 32 }} />
        ) : messages.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ fontSize: 44, marginBottom: 10 }}>📥</Text>
            <Text style={{ fontSize: 14, color: C.fg3, fontFamily: 'Inter_500Medium', textAlign: 'center', lineHeight: 20 }}>
              {statusFilter
                ? `Tidak ada email dengan status ini`
                : 'Belum ada email yang diproses.\nTap Sync untuk scan inbox.'}
            </Text>
          </View>
        ) : (
          messages.map(msg => (
            <View key={msg.id} style={{
              backgroundColor: C.surface, borderRadius: 16, padding: 14, marginBottom: 10,
              shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
              borderLeftWidth: 3, borderLeftColor: statusBorderColor(msg.parseStatus, C),
            }}>
              {/* Status + AI + bank + date row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <StatusBadge status={msg.parseStatus} />
                  {msg.aiUsed && (
                    <View style={{ backgroundColor: '#EDE9FE', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#7C3AED', fontFamily: 'Inter_700Bold' }}>🤖 AI</Text>
                    </View>
                  )}
                  {msg.parsedBank && (
                    <View style={{ backgroundColor: C.creamSunken, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: C.fg2, fontFamily: 'Inter_700Bold' }}>{msg.parsedBank}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 11, color: C.fg4, fontFamily: 'Inter_500Medium' }}>
                  {new Date(msg.receivedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                </Text>
              </View>

              {/* AI merchant override */}
              {msg.aiUsed && msg.aiRawResult?.merchant && (
                <Text style={{ fontSize: 11, color: '#7C3AED', fontFamily: 'Inter_600SemiBold', marginBottom: 4 }}>
                  → {msg.aiRawResult.merchant}
                </Text>
              )}

              {/* Subject */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.fg1, fontFamily: 'Inter_700Bold', marginBottom: 3 }} numberOfLines={2}>
                {msg.subject}
              </Text>

              {/* Amount or skip/error reason */}
              {msg.parseStatus === 'imported' && msg.parsedAmount ? (
                <Text style={{ fontSize: 12, color: C.fg3, fontFamily: 'Inter_500Medium' }}>
                  {msg.parsedMerchant ? `${msg.parsedMerchant} · ` : ''}
                  <Text style={{ fontWeight: '700', color: msg.parsedType === 'income' ? C.primary : C.accent }}>
                    {msg.parsedType === 'income' ? '+' : '-'}Rp {msg.parsedAmount.toLocaleString('id-ID')}
                  </Text>
                </Text>
              ) : (msg.parseError || msg.skipReason) ? (
                <Text style={{ fontSize: 12, color: C.fg3, fontFamily: 'Inter_500Medium' }} numberOfLines={2}>
                  {msg.parseError || msg.skipReason}
                </Text>
              ) : null}

              {/* Reprocess button */}
              {(msg.parseStatus === 'failed' || msg.parseStatus === 'skipped') && (
                <TouchableOpacity
                  onPress={() => handleReprocess(msg.id)}
                  disabled={reprocessingId === msg.id}
                  style={{
                    marginTop: 8, paddingVertical: 7, paddingHorizontal: 12,
                    backgroundColor: reprocessingId === msg.id ? C.border : C.primarySoft,
                    borderRadius: 9, alignSelf: 'flex-start',
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                  }}
                >
                  {reprocessingId === msg.id
                    ? <ActivityIndicator size={12} color={C.primary} />
                    : <Text style={{ fontSize: 12 }}>↺</Text>
                  }
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.primary, fontFamily: 'Inter_700Bold' }}>
                    {reprocessingId === msg.id ? 'Memproses...' : 'Proses ulang'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}

// ── Stat card ──────────────────────────────────────────────────
function StatCard({ label, value, valueColor, bg }: { label: string; value: number; valueColor?: string; bg?: string }) {
  const C = useTheme()
  return (
    <View style={{
      flex: 1, backgroundColor: bg ?? C.surface, borderRadius: 16, padding: 12, alignItems: 'center',
      shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    }}>
      <Text style={{ fontSize: 22, fontWeight: '900', color: valueColor ?? C.fg1, fontFamily: 'Inter_900Black' }}>
        {value}
      </Text>
      <Text style={{ fontSize: 10, color: C.fg3, fontFamily: 'Inter_500Medium', textAlign: 'center', marginTop: 2, lineHeight: 14 }}>
        {label}
      </Text>
    </View>
  )
}

function statusBorderColor(status: string, C: { primary: string; danger: string; mustard: string; border: string }) {
  if (status === 'imported') return C.primary
  if (status === 'failed') return C.danger
  if (status === 'pending') return C.mustard
  return C.border
}

// ── Connect Gmail ──────────────────────────────────────────────
function ConnectGmailView({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const C = useTheme()
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
        await WebBrowser.openAuthSessionAsync(data.url, 'fintrackr://')
      }
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Gagal mendapatkan URL login Google.')
      setLoading(false)
    }
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View style={{ padding: 20 }}>
        <PageHeader title="Hubungkan Gmail" onBack={onBack} />

        <View style={{ backgroundColor: C.surface, borderRadius: 20, padding: 24, marginBottom: 16, shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }}>
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 38 }}>✉️</Text>
            </View>
            <Text style={{ fontSize: 17, fontWeight: '800', color: C.fg1, fontFamily: 'Inter_800ExtraBold', marginBottom: 8 }}>
              Login dengan Google
            </Text>
            <Text style={{ fontSize: 13, color: C.fg3, textAlign: 'center', lineHeight: 20, fontFamily: 'Inter_500Medium' }}>
              Izinkan Budgetin membaca email notifikasi transaksi dari inbox Gmail kamu. Kami hanya membaca — tidak bisa kirim atau hapus.
            </Text>
          </View>

          <View style={{ backgroundColor: C.creamSunken, borderRadius: 14, padding: 14, marginBottom: 20 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.fg2, marginBottom: 10, fontFamily: 'Inter_700Bold' }}>Cara kerjanya:</Text>
            {[
              'Tap tombol di bawah → browser terbuka',
              'Login dengan akun Google yang menerima notif bank',
              'Izinkan akses "read-only" ke Gmail',
              'Kembali ke app — email otomatis terhubung',
              'Worker mulai scan inbox setiap 5 menit',
            ].map((step, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{i + 1}</Text>
                </View>
                <Text style={{ fontSize: 13, color: C.fg2, flex: 1, lineHeight: 18, fontFamily: 'Inter_500Medium' }}>{step}</Text>
              </View>
            ))}
          </View>

          {error ? (
            <View style={{ backgroundColor: C.dangerSoft, borderWidth: 1, borderColor: C.danger, borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 15, marginRight: 8 }}>⚠️</Text>
              <Text style={{ fontSize: 13, color: C.danger, flex: 1, fontFamily: 'Inter_500Medium' }}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleConnect}
            disabled={loading}
            style={{ paddingVertical: 15, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent }}
          >
            {loading
              ? <ActivityIndicator color="white" />
              : <>
                  <Text style={{ fontSize: 17, marginRight: 8 }}>✉️</Text>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, fontFamily: 'Inter_800ExtraBold' }}>Login dengan Google</Text>
                </>
            }
          </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: C.mustardSoft, borderWidth: 1, borderColor: C.mustard, borderRadius: 16, padding: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#8C6B1F', marginBottom: 4, fontFamily: 'Inter_700Bold' }}>⚠️ Perlu Google OAuth</Text>
          <Text style={{ fontSize: 12, color: '#8C6B1F', lineHeight: 18, fontFamily: 'Inter_500Medium' }}>
            Fitur ini butuh GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET di file .env. Jika belum dikonfigurasi, hubungi administrator server.
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}

// ── Reusable ───────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; bg: string; label: string }> = {
    imported: { color: '#41594F', bg: '#DEE8D7',  label: '✅ Imported' },
    pending:  { color: '#8C6B1F', bg: '#FBEFD2',  label: '⏳ Pending' },
    skipped:  { color: '#6F6A63', bg: '#F4EEE3',  label: '⏭️ Lewati' },
    failed:   { color: '#C66B6B', bg: 'rgba(198,107,107,0.1)', label: '❌ Gagal' },
  }
  const c = config[status] ?? config.pending
  return (
    <View style={{ backgroundColor: c.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
      <Text style={{ color: c.color, fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' }}>{c.label}</Text>
    </View>
  )
}

function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const C = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
      <TouchableOpacity onPress={onBack} style={{ marginRight: 10, width: 34, height: 34, borderRadius: 10, backgroundColor: C.creamSunken, alignItems: 'center', justifyContent: 'center' }}>
        <ArrowLeft size={18} color={C.fg1} strokeWidth={2} />
      </TouchableOpacity>
      <Text style={{ fontSize: 18, fontWeight: '800', color: C.fg1, fontFamily: 'Inter_800ExtraBold' }}>{title}</Text>
    </View>
  )
}

function FormField({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  const C = useTheme()
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: C.fg3, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: 'Inter_700Bold' }}>{label}</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: C.fg1, backgroundColor: C.creamSunken }}
        placeholderTextColor={C.fg4}
        {...props}
      />
    </View>
  )
}
