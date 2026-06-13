import { useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, Switch, Alert, ActivityIndicator, Modal, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAuthStore } from '../../src/store/auth.store'
import { authApi, BankParserRule } from '../../src/lib/api'
import {
  useSmtpConfig, useUpdateSmtpConfig, useTestSmtp,
  useParserRules, useCreateParserRule, useToggleParserRule, useDeleteParserRule,
} from '../../src/hooks/useSettings'
import {
  useSubscription, useSubscriptionHistory, useCheckout, useCancelSubscription, useTrialDaysLeft,
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

  const handleLogout = async () => {
    try { if (refreshToken) await authApi.logout(refreshToken) } catch {}
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

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      {/* Profile hero */}
      <View style={{
        backgroundColor: C.heroStart,
        ...(({ background: `linear-gradient(160deg, ${C.heroStart} 0%, ${C.heroEnd} 100%)` }) as any),
        paddingTop: 28, paddingBottom: 32, paddingHorizontal: 20,
        borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
        position: 'relative', overflow: 'hidden',
      }}>
        <View style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 999, backgroundColor: C.accent, opacity: 0.3 }} />
        <View style={{ position: 'absolute', bottom: -30, left: -30, width: 120, height: 120, borderRadius: 999, backgroundColor: '#A2BD97', opacity: 0.35 }} />

        <TouchableOpacity
          onPress={() => onNavigate('account')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, position: 'relative' }}
        >
          <View style={{ width: 64, height: 64, borderRadius: 999, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 24, fontFamily: 'Nunito_900Black' }}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.3, fontFamily: 'Nunito_900Black' }}>{user?.name ?? 'User'}</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontFamily: 'Nunito_500Medium' }}>{user?.email ?? ''}</Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 20, gap: 12, paddingBottom: 40 }}>

        {/* Langganan */}
        <BillingRow onNavigate={onNavigate} />

        {/* Kelola Data */}
        <SectionCard title="Kelola Data">
          <SettingRow icon="💳" iconBg={C.infoSoft} label="Rekening & Akun" sub="Kelola saldo dan rekening" onPress={() => router.push('/(tabs)/accounts')} />
          <SettingRow icon="🏷" iconBg={C.mustardSoft} label="Kategori" sub="Custom kategori transaksi" onPress={() => router.push('/(tabs)/categories')} divider={false} />
        </SectionCard>

        {/* Fitur */}
        <SectionCard title="Fitur">
          <SettingRow icon="✉️" iconBg={C.accentSoft} label="Integrasi Email" sub="Auto-import dari Gmail/IMAP" onPress={() => router.push('/(tabs)/email-integration')} />
          <SettingRow icon="👥" iconBg={C.primarySoft} label="Workspace" sub="Keuangan bersama keluarga/tim" onPress={() => router.push('/(tabs)/workspace')} divider={false} />
        </SectionCard>

        {/* Pengaturan Sistem */}
        <SectionCard title="Pengaturan Sistem">
          <SettingRow icon="📧" iconBg={C.primarySoft} label="Konfigurasi Email" sub="Setup SMTP untuk kirim undangan" onPress={() => onNavigate('smtp')} />
          <SettingRow icon="🏦" iconBg={C.mustardSoft} label="Bank & E-Wallet" sub="Tambah bank yang belum terdaftar" onPress={() => onNavigate('bank-rules')} divider={false} />
        </SectionCard>

        {/* Logout */}
        <TouchableOpacity
          onPress={onLogout}
          style={{
            backgroundColor: C.dangerSoft, borderWidth: 1, borderColor: '#E08989',
            borderRadius: 18, padding: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Text style={{ fontSize: 18 }}>👋</Text>
          <Text style={{ color: C.danger, fontWeight: '800', fontSize: 15, fontFamily: 'Nunito_800ExtraBold' }}>Keluar</Text>
        </TouchableOpacity>

        <Text style={{ textAlign: 'center', fontSize: 12, color: C.fg4, fontFamily: 'Nunito_500Medium' }}>
          Saku v1.0.0 — Self Hosted 🌿
        </Text>
      </View>
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
              <FormField label="From Email"    value={from}    onChange={setFrom}    placeholder="noreply@saku.app" keyboardType="email-address" divider={false} />
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
                    <Text style={{ fontSize: 16 }}>🗑️</Text>
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
        <Text style={{ color: C.fg4, fontSize: 18 }}>›</Text>
      </TouchableOpacity>
    </SectionCard>
  )
}

// ── Billing Section ───────────────────────────────────────────
function BillingSection({ onBack }: { onBack: () => void }) {
  const { data: sub, isLoading } = useSubscription()
  const { data: history = [] }   = useSubscriptionHistory()
  const checkout   = useCheckout()
  const cancel     = useCancelSubscription()
  const daysLeft   = useTrialDaysLeft()
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly')
  const [toast, setToast]   = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const isProActive = sub && (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due')

  const handleCheckout = () => {
    checkout.mutate(
      { plan: 'pro', period },
      {
        onSuccess: (data) => {
          if (data.redirectUrl) {
            if (Platform.OS === 'web') {
              window.open(data.redirectUrl, '_blank')
            }
          } else if (data.snapToken) {
            showToast('Membuka halaman pembayaran…')
            if (Platform.OS === 'web') {
              // Midtrans Snap JS integration
              const snap = (window as any).snap
              if (snap) {
                snap.pay(data.snapToken, {
                  onSuccess: () => showToast('Pembayaran berhasil! ✅'),
                  onPending: () => showToast('Menunggu pembayaran…'),
                  onError: () => showToast('Pembayaran gagal ❌'),
                })
              } else {
                showToast('Snap.js belum dimuat — pastikan MIDTRANS_CLIENT_KEY diset')
              }
            }
          }
        },
        onError: (e: any) => showToast(e?.response?.data?.message ?? 'Gagal memulai pembayaran ❌'),
      }
    )
  }

  const handleCancel = () => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Batalkan langganan Pro? Akses tetap aktif sampai akhir periode.')) return
    }
    cancel.mutate(undefined, {
      onSuccess: () => showToast('Langganan dibatalkan'),
      onError: () => showToast('Gagal membatalkan langganan'),
    })
  }

  const formatAmount = (n: number) =>
    'Rp ' + n.toLocaleString('id-ID')

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

              {/* Upgrade panel — only when not active Pro */}
              {!isProActive || sub?.status === 'trialing' ? (
                <View style={{
                  backgroundColor: C.surface, borderRadius: 20, padding: 20, gap: 16,
                  shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
                }}>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: C.fg1, fontFamily: 'Nunito_900Black' }}>
                    {sub?.status === 'trialing' ? 'Pilih Paket Pro' : 'Upgrade ke Pro'}
                  </Text>

                  {/* Period toggle */}
                  <View style={{ flexDirection: 'row', backgroundColor: C.creamSunken, borderRadius: 12, padding: 4 }}>
                    {(['monthly', 'annual'] as const).map((p) => (
                      <TouchableOpacity
                        key={p}
                        onPress={() => setPeriod(p)}
                        style={{
                          flex: 1, borderRadius: 9, paddingVertical: 9, alignItems: 'center',
                          backgroundColor: period === p ? C.surface : 'transparent',
                          shadowColor: period === p ? '#2D2A26' : 'transparent',
                          shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3,
                          elevation: period === p ? 2 : 0,
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: period === p ? C.fg1 : C.fg3, fontFamily: 'Nunito_700Bold' }}>
                          {p === 'monthly' ? 'Bulanan' : 'Tahunan'}
                        </Text>
                        {p === 'annual' && (
                          <Text style={{ fontSize: 10, color: C.primary, fontFamily: 'Nunito_700Bold' }}>Hemat 17%</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Price display */}
                  <View style={{ alignItems: 'center', paddingVertical: 4 }}>
                    <Text style={{ fontSize: 32, fontWeight: '900', color: C.fg1, fontFamily: 'Nunito_900Black' }}>
                      {period === 'monthly' ? 'Rp 49.000' : 'Rp 490.000'}
                    </Text>
                    <Text style={{ fontSize: 13, color: C.fg3, fontFamily: 'Nunito_500Medium' }}>
                      {period === 'monthly' ? 'per bulan' : 'per tahun (≈ Rp 40.800/bln)'}
                    </Text>
                  </View>

                  {/* Feature list */}
                  <View style={{ backgroundColor: C.cream, borderRadius: 14, padding: 14, gap: 10 }}>
                    {[
                      ['✉️', 'Auto-import Gmail & IMAP'],
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

                  <TouchableOpacity
                    onPress={handleCheckout}
                    disabled={checkout.isPending}
                    style={{
                      backgroundColor: C.primary, borderRadius: 14, padding: 16,
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: checkout.isPending ? 0.6 : 1,
                    }}
                  >
                    {checkout.isPending && <ActivityIndicator size="small" color="#fff" />}
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, fontFamily: 'Nunito_800ExtraBold' }}>
                      {sub?.status === 'trialing' ? 'Upgrade Sekarang' : 'Mulai Trial 14 Hari Gratis'}
                    </Text>
                  </TouchableOpacity>

                  {sub?.status !== 'trialing' && (
                    <Text style={{ textAlign: 'center', fontSize: 11, color: C.fg3, fontFamily: 'Nunito_500Medium' }}>
                      Tidak perlu kartu kredit · Batalkan kapan saja
                    </Text>
                  )}
                </View>
              ) : null}

              {/* Cancel button for active Pro */}
              {sub?.status === 'active' && (
                <TouchableOpacity
                  onPress={handleCancel}
                  disabled={cancel.isPending}
                  style={{
                    backgroundColor: C.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: cancel.isPending ? 0.6 : 1,
                  }}
                >
                  {cancel.isPending && <ActivityIndicator size="small" color={C.fg3} />}
                  <Text style={{ color: C.fg3, fontWeight: '600', fontSize: 14, fontFamily: 'Nunito_600SemiBold' }}>
                    Batalkan Langganan
                  </Text>
                </TouchableOpacity>
              )}

              {/* Payment history */}
              {history.length > 0 && (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: C.fg3, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Nunito_800ExtraBold' }}>
                    Riwayat Pembayaran
                  </Text>
                  {history.map((order) => (
                    <View key={order.id} style={{
                      backgroundColor: C.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                      shadowColor: '#2D2A26', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
                    }}>
                      <Text style={{ fontSize: 18 }}>{order.status === 'paid' ? '✅' : '⏳'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: C.fg1, fontFamily: 'Nunito_700Bold' }}>
                          Pro · {order.period === 'annual' ? 'Tahunan' : 'Bulanan'}
                        </Text>
                        <Text style={{ fontSize: 11, color: C.fg3, fontFamily: 'Nunito_500Medium' }}>
                          {new Date(order.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: C.fg1, fontFamily: 'Nunito_700Bold' }}>
                        {formatAmount(order.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {!!toast && (
        <View style={{
          position: 'absolute', bottom: 20, left: 20, right: 20,
          backgroundColor: C.fg1, borderRadius: 12, padding: 14, alignItems: 'center',
        }}>
          <Text style={{ color: '#fff', fontWeight: '600', fontFamily: 'Nunito_600SemiBold' }}>{toast}</Text>
        </View>
      )}
    </View>
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

function SettingRow({ icon, iconBg, label, sub, onPress, divider = true }: {
  icon: string; iconBg: string; label: string; sub?: string; onPress: () => void; divider?: boolean
}) {
  return (
    <>
      {divider && <View style={{ height: 1, backgroundColor: C.divider, marginLeft: 56 }} />}
      <TouchableOpacity
        onPress={onPress}
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 }}
      >
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18 }}>{icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.fg1, fontFamily: 'Nunito_700Bold' }}>{label}</Text>
          {sub && <Text style={{ fontSize: 12, color: C.fg3, marginTop: 1, fontFamily: 'Nunito_500Medium' }}>{sub}</Text>}
        </View>
        <Text style={{ color: C.fg4, fontSize: 18 }}>›</Text>
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
        <Text style={{ fontSize: 20, color: C.fg1 }}>‹</Text>
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
