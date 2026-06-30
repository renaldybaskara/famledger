import { useState, useEffect, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, Switch, Alert, ActivityIndicator, Modal, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { useAuthStore } from '../../src/store/auth.store'
import { authApi, api, BankParserRule } from '../../src/lib/api'
import { PaymentSlipScanModal } from '../../components/transactions/PaymentSlipScanModal'
import {
  useSmtpConfig, useUpdateSmtpConfig, useTestSmtp,
  useParserRules, useCreateParserRule, useToggleParserRule, useDeleteParserRule,
} from '../../src/hooks/useSettings'
import {
  useSubscription, useCancelSubscription, useTrialDaysLeft, useRestorePurchases, useMidtransPayment, useIsProActive,
} from '../../src/hooks/useSubscription'

// ── Saku tokens ───────────────────────────────────────────────
const C = {
  cream:        '#FAF7F2',
  creamSunken:  '#F4EEE3',
  surface:      '#FFFFFF',
  primary:      '#6B8E6B',
  primarySoft:  '#DEE8D7',
  heroStart:    '#6B8E6B',
  heroEnd:      '#41594F',
  accent:       '#C97B5C',
  accentSoft:   '#F4DDD0',
  danger:       '#C66B6B',
  dangerSoft:   '#F5D9D9',
  mustard:      '#D9A441',
  mustardSoft:  '#FBEFD2',
  infoSoft:     '#DEEAF1',
  fg1:          '#2D2A26',
  fg2:          '#55504A',
  fg3:          '#8E887F',
  fg4:          '#A8A39B',
  border:       '#E0DBD2',
  divider:      '#ECE4D3',
}

type Section = 'main' | 'account' | 'smtp' | 'bank-rules' | 'billing'

// ── Settings Screen ───────────────────────────────────────────
export default function SettingsScreen() {
  const { user, logout, refreshToken } = useAuthStore()
  const [section, setSection] = useState<Section>('main')
  const queryClient = useQueryClient()
  const { section: sectionParam } = useLocalSearchParams<{ section?: string }>()

  useEffect(() => {
    const validSections: Section[] = ['main', 'account', 'smtp', 'bank-rules', 'billing']
    if (sectionParam && validSections.includes(sectionParam as Section)) {
      setSection(sectionParam as Section)
    }
  }, [sectionParam])

  const handleLogout = async () => {
    try { if (refreshToken) await authApi.logout(refreshToken) } catch {}
    queryClient.clear()
    logout()
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      {section === 'main'       && <MainSettings user={user} onLogout={handleLogout} onNavigate={setSection} />}
      {section === 'account'    && <AccountSection user={user} onBack={() => setSection('main')} />}
      {section === 'smtp'       && <SmtpSection onBack={() => setSection('main')} />}
      {section === 'bank-rules' && <BankRulesSection onBack={() => setSection('main')} />}
      {section === 'billing'    && <BillingSection onBack={() => setSection('main')} />}
    </SafeAreaView>
  )
}

// ── Main Settings ─────────────────────────────────────────────
function MainSettings({ user, onLogout, onNavigate }: { user: any; onLogout: () => void; onNavigate: (s: Section) => void }) {
  const initial = user?.name?.charAt(0)?.toUpperCase() ?? 'U'
  const [darkMode, setDarkMode] = useState(false)
  const [scanVisible, setScanVisible] = useState(false)

  const { data: sub } = useSubscription()
  const isPro = useIsProActive()
  const daysLeft = useTrialDaysLeft()

  const { data: workspacesRaw } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get<any[]>('/workspaces').then(r => r.data ?? []),
    staleTime: 60_000,
  })
  const workspaces: any[] = Array.isArray(workspacesRaw) ? workspacesRaw : (workspacesRaw as any)?.data ?? []
  const myWorkspace = workspaces[0]
  const memberCount = myWorkspace?.members?.length ?? 0

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      {/* Profile card */}
      <View style={{
        backgroundColor: C.heroEnd, paddingTop: 24, paddingBottom: 28, paddingHorizontal: 20,
        borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden',
      }}>
        <View style={{ position: 'absolute', top: -30, right: -30, width: 130, height: 130, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' }} />

        <TouchableOpacity
          onPress={() => onNavigate('account')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}
        >
          <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 22, fontFamily: 'Nunito_900Black' }}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 19, fontWeight: '900', color: '#fff', letterSpacing: -0.3, fontFamily: 'Nunito_900Black' }}>{user?.name ?? 'User'}</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontFamily: 'Nunito_500Medium' }}>{user?.email ?? ''}</Text>
          </View>
          {isPro && (
            <View style={{ backgroundColor: C.mustard, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '900', color: '#fff', fontFamily: 'Nunito_900Black' }}>PRO</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12, paddingBottom: 40 }}>

        {/* Paket & Pembayaran — highlighted first */}
        <TouchableOpacity
          onPress={() => onNavigate('billing')}
          style={{
            borderRadius: 20, overflow: 'hidden', padding: 16,
            backgroundColor: C.heroEnd,
            ...(({ background: `linear-gradient(135deg, ${C.heroStart} 0%, ${C.heroEnd} 100%)` }) as any),
            flexDirection: 'row', alignItems: 'center', gap: 14,
          }}
        >
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22 }}>{sub?.status === 'trialing' ? '✨' : sub?.status === 'active' ? '⭐' : '⭐'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#fff', fontFamily: 'Nunito_900Black' }}>Paket & Pembayaran</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontFamily: 'Nunito_500Medium' }}>
              {sub?.status === 'trialing'
                ? `✨ Trial Pro aktif · ${daysLeft ?? 0} hari tersisa`
                : sub?.status === 'active'
                ? '⭐ Pro Aktif'
                : 'Upgrade ke Pro untuk fitur lengkap'}
            </Text>
          </View>
          {Platform.OS === 'web' && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <polyline points="9 18 15 12 9 6" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </TouchableOpacity>

        {/* Workspace */}
        <SectionCard title="Workspace">
          <SettingRow
            icon={Platform.OS === 'web' ? (
              <svg width="17" height="17" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="none" stroke="#3D7A56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9" cy="7" r="4" fill="none" stroke="#3D7A56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" fill="none" stroke="#3D7A56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" fill="none" stroke="#3D7A56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : <Text style={{ fontSize: 14 }}>👥</Text>}
            iconBg="#E8F5EE"
            label={myWorkspace?.name ?? 'Buat Workspace'}
            sub={myWorkspace ? `${memberCount} anggota · Owner` : 'Kelola keuangan bersama keluarga'}
            onPress={() => router.push('/(tabs)/workspace')}
          />
          <SettingRow
            icon={Platform.OS === 'web' ? (
              <svg width="17" height="17" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 12V22H4V12" fill="none" stroke="#5B9BD5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M22 7H2v5h20V7z" fill="none" stroke="#5B9BD5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 22V7" stroke="#5B9BD5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" fill="none" stroke="#5B9BD5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" fill="none" stroke="#5B9BD5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : <Text style={{ fontSize: 14 }}>👛</Text>}
            iconBg="#EDF6FF"
            label="Wallet"
            sub="Tabungan, investasi & saldo"
            onPress={() => router.push('/(tabs)/accounts')}
            divider={false}
          />
        </SectionCard>

        {/* Kategori & Import */}
        <SectionCard title="Kategori & Import">
          <SettingRow
            icon={Platform.OS === 'web' ? (
              <svg width="17" height="17" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="none" stroke="#9B6ED6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="4" y1="22" x2="4" y2="15" stroke="#9B6ED6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : <Text style={{ fontSize: 14 }}>🚩</Text>}
            iconBg="#F5EDFF"
            label="Kategori"
            sub="Kelola & tambah kategori"
            onPress={() => router.push('/(tabs)/categories')}
          />
          <SettingRow
            icon={Platform.OS === 'web' ? (
              <svg width="17" height="17" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="7" height="7" fill="none" stroke="#3D7A56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="14" y="3" width="7" height="7" fill="none" stroke="#3D7A56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="14" y="14" width="7" height="7" fill="none" stroke="#3D7A56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="3" y="14" width="7" height="7" fill="none" stroke="#3D7A56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : <Text style={{ fontSize: 14 }}>📷</Text>}
            iconBg="#F0FAF4"
            label="Scan Slip Pembayaran"
            sub="OCR & AI import foto struk"
            onPress={() => setScanVisible(true)}
            badge="BARU"
            divider={false}
          />
        </SectionCard>

        {/* Sistem */}
        <SectionCard title="Sistem">
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F0F4F2', alignItems: 'center', justifyContent: 'center' }}>
              {Platform.OS === 'web' ? (
                <svg width="17" height="17" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="none" stroke="#5A7066" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : <Text style={{ fontSize: 14 }}>🌙</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.fg1, fontFamily: 'Nunito_700Bold' }}>Mode Gelap</Text>
              <Text style={{ fontSize: 12, color: C.fg3, marginTop: 1, fontFamily: 'Nunito_500Medium' }}>Ikuti tema sistem</Text>
            </View>
            <Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ false: C.border, true: C.primary }} thumbColor="#fff" />
          </View>
          <View style={{ height: 1, backgroundColor: C.divider, marginLeft: 64 }} />
          <TouchableOpacity onPress={onLogout} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFE8E0', alignItems: 'center', justifyContent: 'center' }}>
              {Platform.OS === 'web' ? (
                <svg width="17" height="17" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" fill="none" stroke="#C97B5C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="16 17 21 12 16 7" fill="none" stroke="#C97B5C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="21" y1="12" x2="9" y2="12" stroke="#C97B5C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : <Text style={{ fontSize: 14 }}>🚪</Text>}
            </View>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: '#C97B5C', fontFamily: 'Nunito_700Bold' }}>Keluar</Text>
          </TouchableOpacity>
        </SectionCard>

        <Text style={{ textAlign: 'center', fontSize: 12, color: '#C8D8D2', fontFamily: 'Nunito_500Medium' }}>
          Saku v1.0.0 · Self-hosted
        </Text>
      </View>
      <PaymentSlipScanModal visible={scanVisible} onClose={() => setScanVisible(false)} />
    </ScrollView>
  )
}

// ── Account Section ───────────────────────────────────────────
function AccountSection({ user, onBack }: { user: any; onBack: () => void }) {
  const initial = user?.name?.charAt(0)?.toUpperCase() ?? 'U'
  return (
    <ScrollView style={{ flex: 1 }}>
      <View style={{ padding: 20 }}>
        <SectionHeader title="Akun" onBack={onBack} />
        <View style={{
          backgroundColor: C.surface, borderRadius: 20, padding: 24,
          alignItems: 'center',
          shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
        }}>
          <View style={{ width: 80, height: 80, borderRadius: 999, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 32, fontFamily: 'Nunito_900Black' }}>{initial}</Text>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '900', color: C.fg1, fontFamily: 'Nunito_900Black' }}>{user?.name}</Text>
          <Text style={{ fontSize: 14, color: C.fg3, marginTop: 4, fontFamily: 'Nunito_500Medium' }}>{user?.email}</Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            marginTop: 10, backgroundColor: C.primarySoft, borderRadius: 999,
            paddingHorizontal: 12, paddingVertical: 5,
          }}>
            <Text style={{ fontSize: 12 }}>✅</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.heroEnd, fontFamily: 'Nunito_700Bold' }}>Masuk via Google</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

// ── SMTP Section ──────────────────────────────────────────────
function SmtpSection({ onBack }: { onBack: () => void }) {
  const { data: smtp, isLoading } = useSmtpConfig()
  const updateSmtp = useUpdateSmtpConfig()
  const testSmtp   = useTestSmtp()

  const [host,    setHost]    = useState('')
  const [port,    setPort]    = useState('')
  const [user,    setUser]    = useState('')
  const [pass,    setPass]    = useState('')
  const [from,    setFrom]    = useState('')
  const [enabled, setEnabled] = useState(false)
  const [loaded,  setLoaded]  = useState(false)
  const [toast,   setToast]   = useState('')

  // Populate fields once data loads
  if (smtp && !loaded) {
    setHost(smtp.host ?? '')
    setPort(smtp.port ?? '')
    setUser(smtp.user ?? '')
    setFrom(smtp.from ?? '')
    setEnabled(smtp.enabled ?? false)
    setLoaded(true)
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleSave = () => {
    updateSmtp.mutate(
      { host, port, user, pass: pass || undefined, from, enabled },
      {
        onSuccess: () => showToast('Pengaturan SMTP disimpan ✅'),
        onError:   () => showToast('Gagal menyimpan pengaturan ❌'),
      }
    )
  }

  const handleTest = () => {
    if (Platform.OS === 'web') {
      const email = window.prompt('Kirim email test ke alamat:')
      if (!email) return
      testSmtp.mutate(email, {
        onSuccess: () => showToast(`Email test terkirim ke ${email} ✅`),
        onError:   (e: any) => showToast(e?.response?.data?.message ?? 'Gagal kirim email ❌'),
      })
    } else {
      Alert.prompt('Test Email', 'Masukkan alamat email tujuan:', (email) => {
        if (!email) return
        testSmtp.mutate(email, {
          onSuccess: () => Alert.alert('Berhasil', `Email test terkirim ke ${email}`),
          onError:   (e: any) => Alert.alert('Gagal', e?.response?.data?.message ?? 'Gagal kirim email'),
        })
      }, 'plain-text', '')
    }
  }

  const isConfigured = smtp && smtp.host && smtp.user

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={{ padding: 20 }}>
        <SectionHeader title="Konfigurasi Email" onBack={onBack} />

        {/* Status badge */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: isConfigured ? C.primarySoft : C.mustardSoft,
          borderRadius: 12, padding: 12, marginBottom: 20,
        }}>
          <Text style={{ fontSize: 16 }}>{isConfigured ? '✅' : '⚠️'}</Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: C.fg1, fontFamily: 'Nunito_600SemiBold' }}>
            {isConfigured ? 'SMTP terkonfigurasi' : 'SMTP belum dikonfigurasi — email undangan tidak akan terkirim'}
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
        ) : (
          <View style={{ gap: 14 }}>
            {/* Enabled toggle */}
            <View style={{
              backgroundColor: C.surface, borderRadius: 14, padding: 16,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
            }}>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.fg1, fontFamily: 'Nunito_700Bold' }}>Aktifkan SMTP</Text>
                <Text style={{ fontSize: 12, color: C.fg3, fontFamily: 'Nunito_500Medium' }}>Kirim email undangan & notifikasi</Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                trackColor={{ false: C.border, true: C.primary }}
                thumbColor="#fff"
              />
            </View>

            {/* Form fields */}
            <View style={{ backgroundColor: C.surface, borderRadius: 14, overflow: 'hidden', shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
              <FormField label="SMTP Host"     value={host}    onChange={setHost}    placeholder="smtp.gmail.com" />
              <FormField label="Port"          value={port}    onChange={setPort}    placeholder="587" keyboardType="numeric" />
              <FormField label="Username"      value={user}    onChange={setUser}    placeholder="user@gmail.com" keyboardType="email-address" />
              <FormField label="Password"      value={pass}    onChange={setPass}    placeholder="Kosongkan jika tidak ingin mengubah" secureTextEntry />
              <FormField label="From Email"    value={from}    onChange={setFrom}    placeholder="noreply@famledger.app" keyboardType="email-address" divider={false} />
            </View>

            {/* Buttons */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={updateSmtp.isPending}
              style={{
                backgroundColor: C.primary, borderRadius: 14, padding: 16,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: updateSmtp.isPending ? 0.6 : 1,
              }}
            >
              {updateSmtp.isPending && <ActivityIndicator size="small" color="#fff" />}
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, fontFamily: 'Nunito_800ExtraBold' }}>Simpan Pengaturan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleTest}
              disabled={testSmtp.isPending}
              style={{
                backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: testSmtp.isPending ? 0.6 : 1,
              }}
            >
              {testSmtp.isPending && <ActivityIndicator size="small" color={C.primary} />}
              <Text style={{ color: C.primary, fontWeight: '700', fontSize: 15, fontFamily: 'Nunito_700Bold' }}>Kirim Email Test</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Toast */}
        {!!toast && (
          <View style={{
            position: 'absolute', bottom: 20, left: 20, right: 20,
            backgroundColor: C.fg1, borderRadius: 12, padding: 14,
            alignItems: 'center',
          }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontFamily: 'Nunito_600SemiBold' }}>{toast}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

// ── Bank Rules Section ────────────────────────────────────────
function BankRulesSection({ onBack }: { onBack: () => void }) {
  const { data: rules = [], isLoading } = useParserRules()
  const createRule = useCreateParserRule()
  const toggleRule = useToggleParserRule()
  const deleteRule = useDeleteParserRule()

  const [showModal, setShowModal] = useState(false)
  const [name,      setName]      = useState('')
  const [pattern,   setPattern]   = useState('')
  const [note,      setNote]      = useState('')
  const [toast,     setToast]     = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleAdd = () => {
    if (!name.trim() || !pattern.trim()) return
    const raw = pattern.trim().toLowerCase()
    const fromPatterns = raw.startsWith('@') ? raw : '@' + raw
    createRule.mutate(
      {
        name: name.trim(),
        fromPatterns,
        note: note.trim(),
        subjectPatterns: '',
        expenseKeywords: '',
        incomeKeywords: '',
        bodyConfirmKeywords: '',
        amountRegex: '',
        defaultType: 'expense',
        priority: 0,
        isActive: true,
        isGlobal: true,
      },
      {
        onSuccess: () => {
          setShowModal(false)
          setName(''); setPattern(''); setNote('')
          showToast('Bank berhasil ditambahkan ✅')
        },
        onError: (e: any) => {
          showToast(e?.response?.data?.error ?? 'Gagal menambah bank ❌')
        },
      }
    )
  }

  const handleDelete = (rule: BankParserRule) => {
    if (Platform.OS === 'web') {
      if (!window.confirm(`Hapus "${rule.name}"?`)) return
      deleteRule.mutate(rule.id, { onSuccess: () => showToast(`${rule.name} dihapus`) })
    } else {
      Alert.alert('Hapus Bank', `Hapus "${rule.name}"?`, [
        { text: 'Batal', style: 'cancel' },
        { text: 'Hapus', style: 'destructive', onPress: () => deleteRule.mutate(rule.id) },
      ])
    }
  }

  const isAIOnly = (r: BankParserRule) => !r.amountRegex

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ padding: 20 }}>
          <SectionHeader title="Bank & E-Wallet" onBack={onBack} />

          {/* Info banner */}
          <View style={{
            backgroundColor: C.primarySoft, borderRadius: 12, padding: 12,
            flexDirection: 'row', gap: 8, marginBottom: 20,
          }}>
            <Text style={{ fontSize: 14 }}>ℹ️</Text>
            <Text style={{ flex: 1, fontSize: 12, color: C.heroEnd, fontFamily: 'Nunito_500Medium', lineHeight: 18 }}>
              Bank yang ditambahkan akan diproses AI saat pertama kali. Email berikutnya langsung otomatis tanpa AI.{'\n'}
              Aktifkan <Text style={{ fontWeight: '700' }}>OPENROUTER_API_KEY</Text> di .env agar fitur ini berjalan.
            </Text>
          </View>

          {isLoading ? (
            <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
          ) : rules.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
              <Text style={{ fontSize: 32 }}>🏦</Text>
              <Text style={{ fontSize: 14, color: C.fg3, fontFamily: 'Nunito_500Medium' }}>Belum ada bank yang ditambahkan</Text>
            </View>
          ) : (
            <View style={{ gap: 8, marginBottom: 16 }}>
              {rules.map((rule, i) => (
                <View key={rule.id} style={{
                  backgroundColor: C.surface, borderRadius: 14, padding: 14,
                  shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: C.fg1, fontFamily: 'Nunito_700Bold' }}>{rule.name}</Text>
                      <View style={{
                        backgroundColor: isAIOnly(rule) ? '#EDE9FE' : C.primarySoft,
                        borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: isAIOnly(rule) ? '#6D28D9' : C.heroEnd, fontFamily: 'Nunito_700Bold' }}>
                          {isAIOnly(rule) ? '🤖 AI Mode' : '✅ Terpelajari'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: C.fg3, marginTop: 2, fontFamily: 'Nunito_500Medium' }}>
                      {rule.fromPatterns}
                    </Text>
                  </View>

                  <Switch
                    value={rule.isActive}
                    onValueChange={() => toggleRule.mutate(rule.id)}
                    trackColor={{ false: C.border, true: C.primary }}
                    thumbColor="#fff"
                  />
                  <TouchableOpacity
                    onPress={() => handleDelete(rule)}
                    style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: C.dangerSoft, alignItems: 'center', justifyContent: 'center' }}
                  >
                    {Platform.OS === 'web' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <polyline points="3 6 5 6 21 6" fill="none" stroke={C.danger} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" fill="none" stroke={C.danger} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M10 11v6M14 11v6" fill="none" stroke={C.danger} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : <Text style={{ fontSize: 14 }}>🗑️</Text>}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Add button */}
          <TouchableOpacity
            onPress={() => setShowModal(true)}
            style={{
              backgroundColor: C.primary, borderRadius: 14, padding: 16,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, fontFamily: 'Nunito_800ExtraBold' }}>+ Tambah Bank / E-Wallet</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Toast */}
      {!!toast && (
        <View style={{
          position: 'absolute', bottom: 20, left: 20, right: 20,
          backgroundColor: C.fg1, borderRadius: 12, padding: 14, alignItems: 'center',
        }}>
          <Text style={{ color: '#fff', fontWeight: '600', fontFamily: 'Nunito_600SemiBold' }}>{toast}</Text>
        </View>
      )}

      {/* Add Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: C.fg1, fontFamily: 'Nunito_900Black' }}>Tambah Bank / E-Wallet</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={{ fontSize: 22, color: C.fg3 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12 }}>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.fg2, marginBottom: 6, fontFamily: 'Nunito_700Bold' }}>
                  Nama Bank / E-Wallet <Text style={{ color: C.danger }}>*</Text>
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder='mis. "Bank XYZ", "Dana Plus"'
                  placeholderTextColor={C.fg4}
                  style={{
                    backgroundColor: C.creamSunken, borderRadius: 12, padding: 14,
                    fontSize: 14, color: C.fg1, fontFamily: 'Nunito_500Medium',
                  }}
                />
              </View>

              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.fg2, marginBottom: 6, fontFamily: 'Nunito_700Bold' }}>
                  Domain Email Pengirim <Text style={{ color: C.danger }}>*</Text>
                </Text>
                <TextInput
                  value={pattern}
                  onChangeText={setPattern}
                  placeholder="klikbca.com"
                  placeholderTextColor={C.fg4}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={{
                    backgroundColor: C.creamSunken, borderRadius: 12, padding: 14,
                    fontSize: 14, color: C.fg1, fontFamily: 'Nunito_500Medium',
                  }}
                />
                <Text style={{ fontSize: 11, color: C.fg3, marginTop: 4, fontFamily: 'Nunito_500Medium', lineHeight: 16 }}>
                  Contoh: <Text style={{ fontFamily: 'Nunito_700Bold' }}>klikbca.com</Text> (BCA) · <Text style={{ fontFamily: 'Nunito_700Bold' }}>gopay.co.id</Text> (GoPay) · <Text style={{ fontFamily: 'Nunito_700Bold' }}>dana.id</Text> (DANA)
                </Text>

                {/* How-to tip */}
                <View style={{
                  backgroundColor: C.mustardSoft, borderRadius: 10, padding: 10, marginTop: 8,
                  flexDirection: 'row', gap: 8,
                }}>
                  <Text style={{ fontSize: 13 }}>💡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#7A5C1E', fontFamily: 'Nunito_700Bold', marginBottom: 2 }}>
                      Cara cek domain yang benar
                    </Text>
                    <Text style={{ fontSize: 11, color: '#7A5C1E', fontFamily: 'Nunito_500Medium', lineHeight: 16 }}>
                      1. Buka email notifikasi dari bank di Gmail{'\n'}
                      2. Klik nama pengirim → lihat alamat email penuh{'\n'}
                      3. Salin bagian setelah tanda <Text style={{ fontFamily: 'Nunito_700Bold' }}>@</Text>{'\n'}
                      {'   '}mis. <Text style={{ fontFamily: 'Nunito_700Bold' }}>no-reply@klikbca.com</Text> → isi <Text style={{ fontFamily: 'Nunito_700Bold' }}>klikbca.com</Text>
                    </Text>
                  </View>
                </View>
              </View>

              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.fg2, marginBottom: 6, fontFamily: 'Nunito_700Bold' }}>Catatan (opsional)</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Catatan tambahan..."
                  placeholderTextColor={C.fg4}
                  style={{
                    backgroundColor: C.creamSunken, borderRadius: 12, padding: 14,
                    fontSize: 14, color: C.fg1, fontFamily: 'Nunito_500Medium',
                  }}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                style={{ flex: 1, backgroundColor: C.creamSunken, borderRadius: 12, padding: 14, alignItems: 'center' }}
              >
                <Text style={{ fontWeight: '700', color: C.fg2, fontFamily: 'Nunito_700Bold' }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAdd}
                disabled={!name.trim() || !pattern.trim() || createRule.isPending}
                style={{
                  flex: 2, backgroundColor: C.primary, borderRadius: 12, padding: 14,
                  alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                  opacity: (!name.trim() || !pattern.trim() || createRule.isPending) ? 0.5 : 1,
                }}
              >
                {createRule.isPending && <ActivityIndicator size="small" color="#fff" />}
                <Text style={{ fontWeight: '800', color: '#fff', fontFamily: 'Nunito_800ExtraBold' }}>Tambah</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

// ── Billing Row (inline card in Main Settings) ────────────────
function BillingRow({ onNavigate }: { onNavigate: (s: Section) => void }) {
  const { data: sub } = useSubscription()
  const daysLeft = useTrialDaysLeft()

  const isPro = sub?.status === 'active'
  const isTrialing = sub?.status === 'trialing'
  const isFree = !sub || sub.status === 'free' || sub.status === 'canceled'

  let badge = { icon: '🌿', label: 'Gratis', bg: C.primarySoft, color: C.heroEnd }
  if (isPro)      badge = { icon: '⭐', label: 'Pro Aktif', bg: '#EDE9FE', color: '#5B21B6' }
  if (isTrialing) badge = { icon: '✨', label: `Trial · ${daysLeft ?? 0}h tersisa`, bg: C.mustardSoft, color: '#7A5C1E' }

  return (
    <SectionCard title="Langganan">
      <TouchableOpacity
        onPress={() => onNavigate('billing')}
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}
      >
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: badge.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18 }}>{badge.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.fg1, fontFamily: 'Nunito_700Bold' }}>Paket & Pembayaran</Text>
          <Text style={{ fontSize: 12, marginTop: 1, fontFamily: 'Nunito_600SemiBold', color: badge.color }}>
            {badge.label}
          </Text>
        </View>
        {isFree && (
          <View style={{ backgroundColor: C.accentSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: C.accent, fontFamily: 'Nunito_800ExtraBold' }}>UPGRADE</Text>
          </View>
        )}
        {Platform.OS === 'web' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <polyline points="9 18 15 12 9 6" fill="none" stroke={C.fg4} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : <Text style={{ color: C.fg4, fontSize: 16 }}>›</Text>}
      </TouchableOpacity>
    </SectionCard>
  )
}

// ── Billing Section ───────────────────────────────────────────
function BillingSection({ onBack }: { onBack: () => void }) {
  const { data: sub, isLoading } = useSubscription()
  const restore  = useRestorePurchases()
  const daysLeft = useTrialDaysLeft()
  const midtransPay = useMidtransPayment()
  const [showPaywall, setShowPaywall] = useState(false)
  const [showCustomerCenter, setShowCustomerCenter] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'annual' | 'lifetime'>('monthly')

  const isProActive = sub && (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due')

  const periodOptions = [
    { value: 'monthly'  as const, label: 'Bulanan',       price: 'Rp 29.000/bln' },
    { value: 'annual'   as const, label: 'Tahunan',        price: 'Rp 249.000/thn', note: 'Hemat 29%' },
    { value: 'lifetime' as const, label: 'Seumur Hidup',   price: 'Rp 499.000' },
  ]

  const handleOpenPaywall = () => {
    if (Platform.OS === 'web') {
      midtransPay.mutate(
        { period: selectedPeriod },
        { onError: (err: unknown) => Alert.alert('Gagal', err instanceof Error ? err.message : 'Terjadi kesalahan, coba lagi.') },
      )
      return
    }
    setShowPaywall(true)
  }

  const handleOpenCustomerCenter = () => {
    if (Platform.OS === 'web') {
      Alert.alert('Kelola Langganan', 'Kelola langganan melalui App Store atau Google Play di perangkat iOS/Android kamu.')
      return
    }
    setShowCustomerCenter(true)
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ padding: 20, gap: 16 }}>
          <SectionHeader title="Langganan" onBack={onBack} />

          {isLoading ? (
            <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Current status card */}
              <View style={{
                backgroundColor: C.surface, borderRadius: 20, padding: 20,
                shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
              }}>
                {sub?.status === 'trialing' && (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Text style={{ fontSize: 20 }}>✨</Text>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: C.fg1, fontFamily: 'Nunito_900Black' }}>Trial Pro Aktif</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: C.fg3, fontFamily: 'Nunito_500Medium' }}>
                      {daysLeft === 0
                        ? 'Trial berakhir hari ini — upgrade sekarang!'
                        : `${daysLeft} hari tersisa dari 14 hari trial gratis`}
                    </Text>
                    <View style={{ height: 6, backgroundColor: C.mustardSoft, borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
                      <View style={{
                        height: 6, backgroundColor: C.mustard,
                        width: `${Math.min(100, ((14 - (daysLeft ?? 0)) / 14) * 100)}%`,
                        borderRadius: 3,
                      }} />
                    </View>
                  </>
                )}
                {sub?.status === 'active' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 28 }}>⭐</Text>
                    <View>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: '#5B21B6', fontFamily: 'Nunito_900Black' }}>Pro Aktif</Text>
                      {sub.currentPeriodEnd && (
                        <Text style={{ fontSize: 12, color: C.fg3, fontFamily: 'Nunito_500Medium' }}>
                          Perpanjang: {new Date(sub.currentPeriodEnd).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
                {(!sub || sub.status === 'free' || sub.status === 'canceled') && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 28 }}>🌿</Text>
                    <View>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: C.fg1, fontFamily: 'Nunito_900Black' }}>Paket Gratis</Text>
                      <Text style={{ fontSize: 12, color: C.fg3, fontFamily: 'Nunito_500Medium' }}>Upgrade untuk fitur lengkap</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Upgrade panel — only when not active Pro (or still trialing) */}
              {(!isProActive || sub?.status === 'trialing') && (
                <View style={{
                  backgroundColor: C.surface, borderRadius: 20, padding: 20, gap: 16,
                  shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
                }}>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: C.fg1, fontFamily: 'Nunito_900Black' }}>
                    {sub?.status === 'trialing' ? 'Pilih Paket Pro' : 'Upgrade ke Pro'}
                  </Text>

                  {/* Feature list */}
                  <View style={{ backgroundColor: C.cream, borderRadius: 14, padding: 14, gap: 10 }}>
                    {[
                      ['✉️', 'Auto-import Gmail'],
                      ['👥', 'Workspace keluarga (5 anggota)'],
                      ['🤖', 'AI kategorisasi merchant'],
                      ['🏦', 'Custom bank parser rules'],
                      ['📊', 'Transaksi & budget tak terbatas'],
                    ].map(([icon, label]) => (
                      <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{icon}</Text>
                        <Text style={{ fontSize: 13, color: C.fg2, fontFamily: 'Nunito_600SemiBold' }}>{label}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Period picker — web only */}
                  {Platform.OS === 'web' && (
                    <View style={{ gap: 8 }}>
                      {periodOptions.map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={() => setSelectedPeriod(opt.value)}
                          style={{
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                            padding: 12, borderRadius: 12,
                            borderWidth: 2,
                            borderColor: selectedPeriod === opt.value ? (opt.value === 'lifetime' ? C.mustard : C.primary) : C.border,
                            backgroundColor: selectedPeriod === opt.value ? (opt.value === 'lifetime' ? C.mustardSoft : C.primarySoft) : C.surface,
                          }}
                        >
                          <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: C.fg1 }}>{opt.label}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {opt.note && (
                              <View style={{ backgroundColor: C.mustard, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                                <Text style={{ fontSize: 10, fontFamily: 'Nunito_700Bold', color: '#fff' }}>{opt.note}</Text>
                              </View>
                            )}
                            <Text style={{ fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: C.fg2 }}>{opt.price}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={handleOpenPaywall}
                    disabled={midtransPay.isPending}
                    style={{
                      backgroundColor: C.primary, borderRadius: 14, padding: 16,
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: midtransPay.isPending ? 0.7 : 1,
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, fontFamily: 'Nunito_800ExtraBold' }}>
                      {midtransPay.isPending ? 'Memproses...' : (sub?.status === 'trialing' ? 'Upgrade Sekarang' : 'Bayar Sekarang')}
                    </Text>
                  </TouchableOpacity>

                  <Text style={{ textAlign: 'center', fontSize: 11, color: C.fg3, fontFamily: 'Nunito_500Medium' }}>
                    Tersedia di iOS & Android · Batalkan kapan saja
                  </Text>
                </View>
              )}

              {/* Active Pro — manage via Customer Center */}
              {sub?.status === 'active' && (
                <TouchableOpacity
                  onPress={handleOpenCustomerCenter}
                  style={{
                    backgroundColor: C.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <Text style={{ color: C.fg2, fontWeight: '600', fontSize: 14, fontFamily: 'Nunito_600SemiBold' }}>
                    Kelola Langganan
                  </Text>
                </TouchableOpacity>
              )}

              {/* Restore purchases */}
              <TouchableOpacity
                onPress={() => restore.mutate()}
                disabled={restore.isPending}
                style={{ alignItems: 'center', paddingVertical: 8 }}
              >
                {restore.isPending
                  ? <ActivityIndicator size="small" color={C.fg4} />
                  : <Text style={{ fontSize: 12, color: C.fg4, fontFamily: 'Nunito_600SemiBold' }}>Pulihkan Pembelian</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {/* RevenueCat Paywall (native only) */}
      {showPaywall && Platform.OS !== 'web' && (
        <RevenueCatPaywall onDismiss={() => setShowPaywall(false)} />
      )}

      {/* RevenueCat Customer Center (native only) */}
      {showCustomerCenter && Platform.OS !== 'web' && (
        <RevenueCatCustomerCenter onDismiss={() => setShowCustomerCenter(false)} />
      )}
    </View>
  )
}

// ── RevenueCat Paywall (lazy-loaded, native only) ─────────────
function RevenueCatPaywall({ onDismiss }: { onDismiss: () => void }) {
  const qc = useQueryClient()
  const [PaywallView, setPaywallView] = useState<any>(null)

  useState(() => {
    import('react-native-purchases-ui').then((mod) => {
      setPaywallView(() => mod.default?.Paywall ?? null)
    }).catch(() => setPaywallView(null))
  })

  if (!PaywallView) return null

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <PaywallView
        onPurchaseCompleted={() => {
          qc.invalidateQueries({ queryKey: ['revenuecat'] })
          qc.invalidateQueries({ queryKey: ['subscription'] })
          onDismiss()
        }}
        onRestoreCompleted={() => {
          qc.invalidateQueries({ queryKey: ['revenuecat'] })
          qc.invalidateQueries({ queryKey: ['subscription'] })
          onDismiss()
        }}
        onDismiss={onDismiss}
      />
    </Modal>
  )
}

// ── RevenueCat Customer Center (lazy-loaded, native only) ─────
function RevenueCatCustomerCenter({ onDismiss }: { onDismiss: () => void }) {
  const [CustomerCenterView, setCustomerCenterView] = useState<any>(null)

  useState(() => {
    import('react-native-purchases-ui').then((mod) => {
      setCustomerCenterView(() => mod.default?.CustomerCenterView ?? null)
    }).catch(() => setCustomerCenterView(null))
  })

  if (!CustomerCenterView) return null

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <CustomerCenterView onDismiss={onDismiss} />
    </Modal>
  )
}

// ── Shared sub-components ─────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 18, overflow: 'hidden', shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
        <Text style={{ fontSize: 11, fontWeight: '800', color: C.fg4, textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: 'Nunito_800ExtraBold' }}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  )
}

function SettingRow({ icon, iconBg, label, sub, onPress, divider = true, badge }: {
  icon: ReactNode; iconBg: string; label: string; sub?: string; onPress: () => void; divider?: boolean; badge?: string
}) {
  return (
    <>
      {divider && <View style={{ height: 1, backgroundColor: C.divider, marginLeft: 64 }} />}
      <TouchableOpacity
        onPress={onPress}
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 }}
      >
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.fg1, fontFamily: 'Nunito_700Bold' }}>{label}</Text>
            {badge && (
              <View style={{ backgroundColor: C.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 9, fontWeight: '900', color: '#fff', fontFamily: 'Nunito_900Black', letterSpacing: 0.3 }}>{badge}</Text>
              </View>
            )}
          </View>
          {sub && <Text style={{ fontSize: 12, color: C.fg3, marginTop: 1, fontFamily: 'Nunito_500Medium' }}>{sub}</Text>}
        </View>
        {Platform.OS === 'web' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <polyline points="9 18 15 12 9 6" fill="none" stroke={C.fg4} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : <Text style={{ color: C.fg4, fontSize: 16 }}>›</Text>}
      </TouchableOpacity>
    </>
  )
}

function SectionHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 }}>
      <TouchableOpacity
        onPress={onBack}
        style={{ width: 38, height: 38, backgroundColor: C.surface, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {Platform.OS === 'web' ? (
          <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <polyline points="15 18 9 12 15 6" fill="none" stroke={C.fg1} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : <Text style={{ color: C.fg1, fontSize: 18 }}>‹</Text>}
      </TouchableOpacity>
      <Text style={{ fontSize: 22, fontWeight: '900', color: C.fg1, fontFamily: 'Nunito_900Black' }}>{title}</Text>
    </View>
  )
}

function FormField({ label, value, onChange, placeholder, secureTextEntry, keyboardType, divider = true }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; secureTextEntry?: boolean; keyboardType?: any; divider?: boolean
}) {
  return (
    <>
      {divider && <View style={{ height: 1, backgroundColor: C.divider, marginHorizontal: 16 }} />}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: C.fg3, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4, fontFamily: 'Nunito_700Bold' }}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.fg4}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize="none"
          style={{
            backgroundColor: C.creamSunken, borderRadius: 10, padding: 11,
            fontSize: 14, color: C.fg1, fontFamily: 'Nunito_500Medium',
          }}
        />
      </View>
    </>
  )
}
