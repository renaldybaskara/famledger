import { useState } from 'react'
import { router } from 'expo-router'
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Modal, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../src/lib/api'
import { useAuthStore } from '../../src/store/auth.store'
import { useIsProActive, useSubscription } from '../../src/hooks/useSubscription'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { TransactionItem } from '../../components/transactions/TransactionItem'
import { formatCurrency } from '../../src/lib/format'
import { useTheme } from '../../src/lib/theme'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Workspace {
  id: string
  name: string
  description?: string
  tier: 'personal' | 'family' | 'business'
  currency: string
  createdAt: string
}

interface Member {
  userId: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'contributor' | 'viewer'
  joinedAt: string
}

interface Invite {
  id: string
  email: string
  role: string
  token?: string
  createdAt: string
  expiresAt: string
}

interface ActivityLog {
  id: string
  action: string
  actorName: string
  targetName?: string
  createdAt: string
}

// ─── API ─────────────────────────────────────────────────────────────────────
const wsApi = {
  list:          () => api.get<Workspace[]>('/workspaces'),
  myPendingInvites: () => api.get<Invite[]>('/workspaces/invites/pending'),
  create:        (d: { name: string; description?: string; tier: string; currency?: string }) =>
                   api.post<Workspace>('/workspaces', d),
  update:        (id: string, d: { name?: string; description?: string }) =>
                   api.patch<Workspace>(`/workspaces/${id}`, d),
  delete:        (id: string) => api.delete(`/workspaces/${id}`),
  members:       (id: string) => api.get<Member[]>(`/workspaces/${id}/members`),
  updateRole:    (wsId: string, userId: string, role: string) =>
                   api.patch(`/workspaces/${wsId}/members/${userId}`, { role }),
  removeMember:  (wsId: string, userId: string) =>
                   api.delete(`/workspaces/${wsId}/members/${userId}`),
  leave:         (wsId: string) => api.delete(`/workspaces/${wsId}/leave`),
  invites:       (wsId: string) => api.get<Invite[]>(`/workspaces/${wsId}/invites`),
  invite:        (wsId: string, email: string, role: string) =>
                   api.post(`/workspaces/${wsId}/invites`, { email, role }),
  revokeInvite:  (wsId: string, inviteId: string) =>
                   api.delete(`/workspaces/${wsId}/invites/${inviteId}`),
  activity:      (wsId: string) => api.get<ActivityLog[]>(`/workspaces/${wsId}/activity`),
  summary:       (wsId: string, params?: { startDate?: string; endDate?: string }) =>
                   api.get<any>(`/workspaces/${wsId}/summary`, { params }),
  transactions:  (wsId: string, params?: { page?: number; limit?: number; type?: string; search?: string }) =>
                   api.get<any>(`/workspaces/${wsId}/transactions`, { params }),
  categoryBreakdown: (wsId: string, params?: { type?: string; startDate?: string; endDate?: string }) =>
                   api.get<any[]>(`/workspaces/${wsId}/category-breakdown`, { params }),
}

// ─── Role config ─────────────────────────────────────────────────────────────
const ROLES = [
  { value: 'admin',       label: 'Admin',       icon: '🛡',  desc: 'Undang member, ubah role' },
  { value: 'contributor', label: 'Kontributor', icon: '✎',   desc: 'Tambah & edit transaksi' },
  { value: 'viewer',      label: 'Viewer',      icon: '👁',   desc: 'Hanya lihat data' },
]

function RoleIcon({ role }: { role: string }) {
  const C = useTheme()
  if (role === 'owner') return <Text style={{ fontSize: 14 }}>👑</Text>
  if (role === 'admin') return <Text style={{ fontSize: 14 }}>🛡</Text>
  if (role === 'contributor') return <Text style={{ fontSize: 14 }}>✎</Text>
  return <Text style={{ fontSize: 14, color: C.fg4 }}>👁</Text>
}

function roleLabel(role: string) {
  return { owner: 'Owner', admin: 'Admin', contributor: 'Kontributor', viewer: 'Viewer' }[role] ?? role
}

// ─── Create Workspace Modal ───────────────────────────────────────────────────
function CreateWorkspaceModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const C = useTheme()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [tier, setTier] = useState<'family' | 'business'>('family')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => wsApi.create({ name: name.trim(), description: desc.trim(), tier }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] })
      setName(''); setDesc(''); onClose()
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Gagal membuat workspace'),
  })

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: C.fg1, fontFamily: 'Nunito_700Bold' }}>Buat Workspace Baru</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 20, color: C.fg4, lineHeight: 24 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={{ backgroundColor: C.dangerSoft, borderWidth: 1, borderColor: C.danger, borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: C.danger, fontSize: 13, textAlign: 'center' }}>{error}</Text>
            </View>
          ) : null}

          <Text style={{ fontSize: 13, fontWeight: '600', color: C.fg2, fontFamily: 'Nunito_600SemiBold', marginBottom: 8 }}>Jenis Workspace</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            {[
              { v: 'family',   label: 'Keluarga', icon: '👨‍👩‍👧' },
              { v: 'business', label: 'Bisnis',   icon: '💼' },
            ].map((t) => (
              <TouchableOpacity
                key={t.v}
                onPress={() => setTier(t.v as any)}
                style={{ flex: 1, padding: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, backgroundColor: tier === t.v ? C.primarySoft : C.creamSunken, borderColor: tier === t.v ? C.primary : C.border }}
              >
                <Text style={{ fontSize: 24 }}>{t.icon}</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', marginTop: 6, color: tier === t.v ? C.primary : C.fg2 }}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={{ fontSize: 13, fontWeight: '600', color: C.fg2, fontFamily: 'Nunito_600SemiBold', marginBottom: 8 }}>Nama Workspace</Text>
          <TextInput
            style={{ backgroundColor: C.creamSunken, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: C.fg1, marginBottom: 12 }}
            placeholder="Contoh: Keuangan Keluarga"
            placeholderTextColor={C.fg4}
            value={name}
            onChangeText={setName}
          />

          <Text style={{ fontSize: 13, fontWeight: '600', color: C.fg2, fontFamily: 'Nunito_600SemiBold', marginBottom: 8 }}>Deskripsi (opsional)</Text>
          <TextInput
            style={{ backgroundColor: C.creamSunken, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: C.fg1, marginBottom: 20 }}
            placeholder="Untuk apa workspace ini..."
            placeholderTextColor={C.fg4}
            value={desc}
            onChangeText={setDesc}
            multiline
            numberOfLines={2}
          />

          <TouchableOpacity
            onPress={() => { setError(''); mutation.mutate() }}
            disabled={mutation.isPending || !name.trim()}
            style={{ borderRadius: 14, paddingVertical: 16, alignItems: 'center', backgroundColor: !name.trim() || mutation.isPending ? C.primarySoft : C.primary }}
          >
            {mutation.isPending
              ? <ActivityIndicator color="white" />
              : <Text style={{ color: C.surface, fontWeight: '700', fontSize: 16, fontFamily: 'Nunito_700Bold' }}>Buat Workspace</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}


// ─── Invite Modal ─────────────────────────────────────────────────────────────
function InviteModal({ visible, wsId, onClose }: { visible: boolean; wsId: string; onClose: () => void }) {
  const C = useTheme()
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('contributor')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const mutation = useMutation({
    mutationFn: () => wsApi.invite(wsId, email.trim(), role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ws-invites', wsId] })
      setSuccess(`Undangan terkirim ke ${email}`)
      setEmail('')
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Gagal mengirim undangan'),
  })

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: C.fg1, fontFamily: 'Nunito_700Bold' }}>Undang Anggota</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 20, color: C.fg4, lineHeight: 24 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={{ backgroundColor: C.dangerSoft, borderWidth: 1, borderColor: C.danger, borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <Text style={{ color: C.danger, fontSize: 13, textAlign: 'center' }}>{error}</Text>
            </View>
          ) : null}
          {success ? (
            <View style={{ backgroundColor: C.primarySoft, borderWidth: 1, borderColor: '#C2D4B9', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: C.heroEnd, marginRight: 8 }}>✓</Text>
              <Text style={{ color: C.heroEnd, fontSize: 13, flex: 1 }}>{success}</Text>
            </View>
          ) : null}

          <Text style={{ fontSize: 13, fontWeight: '600', color: C.fg2, fontFamily: 'Nunito_600SemiBold', marginBottom: 8 }}>Email</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.creamSunken, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 16, color: C.fg4 }}>✉️</Text>
            <TextInput
              style={{ flex: 1, marginLeft: 12, paddingVertical: 14, color: C.fg1 }}
              placeholder="email@contoh.com"
              placeholderTextColor={C.fg4}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <Text style={{ fontSize: 13, fontWeight: '600', color: C.fg2, fontFamily: 'Nunito_600SemiBold', marginBottom: 8 }}>Role</Text>
          <View style={{ gap: 8, marginBottom: 20 }}>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r.value}
                onPress={() => setRole(r.value)}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, backgroundColor: role === r.value ? C.primarySoft : C.creamSunken, borderColor: role === r.value ? C.primary : C.border }}
              >
                <Text style={{ fontSize: 16 }}>{r.icon}</Text>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontWeight: '600', fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: role === r.value ? C.primary : C.fg2 }}>
                    {r.label}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.fg4, fontFamily: 'Nunito_500Medium' }}>{r.desc}</Text>
                </View>
                {role === r.value && <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: C.primary }} />}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => { setError(''); setSuccess(''); mutation.mutate() }}
            disabled={mutation.isPending || !email.trim()}
            style={{ borderRadius: 14, paddingVertical: 16, alignItems: 'center', backgroundColor: !email.trim() || mutation.isPending ? C.primarySoft : C.primary }}
          >
            {mutation.isPending
              ? <ActivityIndicator color="white" />
              : <Text style={{ color: C.surface, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>Kirim Undangan</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}


// ─── Workspace Detail ─────────────────────────────────────────────────────────
function WorkspaceDetail({ ws, onBack }: { ws: Workspace; onBack: () => void }) {
  const C = useTheme()
  const qc = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const [tab, setTab] = useState<'members' | 'invites' | 'summary' | 'transactions'>('members')
  const [showInvite, setShowInvite] = useState(false)

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['ws-members', ws.id],
    queryFn: () => wsApi.members(ws.id).then(r => r.data),
  })

  const { data: invites, isLoading: invitesLoading } = useQuery({
    queryKey: ['ws-invites', ws.id],
    queryFn: () => wsApi.invites(ws.id).then(r => r.data),
    enabled: tab === 'invites',
  })

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['ws-summary', ws.id],
    queryFn: () => wsApi.summary(ws.id).then(r => r.data),
    enabled: tab === 'summary',
  })

  const { data: categoryBreakdown } = useQuery({
    queryKey: ['ws-category-breakdown', ws.id],
    queryFn: () => wsApi.categoryBreakdown(ws.id).then(r => r.data ?? []),
    enabled: tab === 'summary',
  })

  const { data: wsTxData, isLoading: wsTxLoading } = useQuery({
    queryKey: ['ws-transactions', ws.id],
    queryFn: () => wsApi.transactions(ws.id, { limit: 50 }).then(r => r.data),
    enabled: tab === 'transactions',
  })

  const myRole = members?.find(m => m.userId === currentUser?.id)?.role ?? 'viewer'
  const canManage = myRole === 'owner' || myRole === 'admin'

  const updateRoleMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      wsApi.updateRole(ws.id, userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ws-members', ws.id] }),
  })

  const removeMut = useMutation({
    mutationFn: (userId: string) => wsApi.removeMember(ws.id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ws-members', ws.id] }),
  })

  const revokeInviteMut = useMutation({
    mutationFn: (inviteId: string) => wsApi.revokeInvite(ws.id, inviteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ws-invites', ws.id] }),
  })

  const TABS = [
    { key: 'members',      label: 'Anggota' },
    { key: 'summary',      label: 'Ringkasan' },
    { key: 'transactions', label: 'Transaksi' },
    { key: 'invites',      label: 'Undangan' },
  ] as const

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={{ backgroundColor: C.primary, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}>
        <TouchableOpacity onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 20, color: 'rgba(255,255,255,0.7)', lineHeight: 24 }}>‹</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginLeft: 4, fontFamily: 'Nunito_500Medium' }}>Workspace</Text>
        </TouchableOpacity>
        <Text style={{ color: C.surface, fontSize: 24, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>{ws.name}</Text>
        {ws.description ? (
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 }}>{ws.description}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 12 }}>👥</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginLeft: 6, fontWeight: '500', fontFamily: 'Nunito_500Medium' }}>
              {members?.length ?? 0} anggota
            </Text>
          </View>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginLeft: 8 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '500', fontFamily: 'Nunito_500Medium' }}>{ws.tier}</Text>
          </View>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginLeft: 8 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '500', fontFamily: 'Nunito_500Medium' }}>{myRole === 'owner' ? '👑 Owner' : roleLabel(myRole)}</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: C.surface, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.divider }}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={{ paddingVertical: 14, marginRight: 24, borderBottomWidth: 2, borderBottomColor: tab === t.key ? C.primary : 'transparent' }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: tab === t.key ? C.primary : C.fg4 }}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
        {/* Members tab */}
        {tab === 'members' && (
          <>
            {canManage && (
              <TouchableOpacity
                onPress={() => setShowInvite(true)}
                style={{ backgroundColor: C.primarySoft, borderWidth: 1, borderColor: 'rgba(107,142,107,0.2)', borderRadius: 20, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}
              >
                <View style={{ width: 40, height: 40, backgroundColor: 'rgba(107,142,107,0.1)', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Text style={{ fontSize: 20 }}>👤</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.primary, fontWeight: '600', fontFamily: 'Nunito_600SemiBold' }}>Undang Anggota Baru</Text>
                  <Text style={{ color: C.fg4, fontSize: 11, marginTop: 2, fontFamily: 'Nunito_500Medium' }}>Kirim undangan via email</Text>
                </View>
                <Text style={{ fontSize: 18, color: C.primary }}>›</Text>
              </TouchableOpacity>
            )}

            {membersLoading ? (
              <ActivityIndicator color={C.primary} style={{ marginTop: 32 }} />
            ) : (
              <View style={{ backgroundColor: C.surface, borderRadius: 20, overflow: 'hidden' }}>
                {(members ?? []).map((m, idx) => (
                  <View key={m.userId}>
                    <View style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 40, height: 40, backgroundColor: 'rgba(107,142,107,0.1)', borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Text style={{ color: C.primary, fontWeight: '700', fontSize: 16, fontFamily: 'Nunito_700Bold' }}>
                          {m.name?.charAt(0)?.toUpperCase() ?? '?'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ color: C.fg1, fontWeight: '600', fontSize: 13, fontFamily: 'Nunito_600SemiBold' }}>{m.name}</Text>
                          {m.userId === currentUser?.id && (
                            <Text style={{ color: C.fg4, fontSize: 11, marginLeft: 6, fontFamily: 'Nunito_500Medium' }}>(kamu)</Text>
                          )}
                        </View>
                        <Text style={{ color: C.fg4, fontSize: 11, fontFamily: 'Nunito_500Medium' }}>{m.email}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <RoleIcon role={m.role} />
                        <Text style={{ color: C.fg3, fontSize: 11, marginLeft: 4, marginRight: 8, fontFamily: 'Nunito_500Medium' }}>{roleLabel(m.role)}</Text>
                        {canManage && m.role !== 'owner' && m.userId !== currentUser?.id && (
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert('Keluarkan Anggota', `Keluarkan ${m.name} dari workspace?`, [
                                { text: 'Batal', style: 'cancel' },
                                { text: 'Keluarkan', style: 'destructive', onPress: () => removeMut.mutate(m.userId) },
                              ])
                            }}
                            style={{ width: 28, height: 28, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.dangerSoft }}
                          >
                            <Text style={{ fontSize: 12, color: C.danger }}>✕</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    {idx < (members ?? []).length - 1 && <View style={{ height: 1, backgroundColor: C.creamSunken, marginLeft: 64 }} />}
                  </View>
                ))}
              </View>
            )}

            {/* Leave workspace button */}
            {myRole !== 'owner' && (
              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Keluar Workspace', 'Keluar dari workspace ini?', [
                    { text: 'Batal', style: 'cancel' },
                    {
                      text: 'Keluar', style: 'destructive', onPress: () =>
                        wsApi.leave(ws.id).then(() => {
                          qc.invalidateQueries({ queryKey: ['workspaces'] })
                          onBack()
                        }),
                    },
                  ])
                }}
                style={{ marginTop: 16, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24, backgroundColor: 'rgba(198,107,107,0.08)', borderWidth: 1, borderColor: 'rgba(198,107,107,0.2)' }}
              >
                <Text style={{ fontSize: 16, marginRight: 8 }}>↗</Text>
                <Text style={{ color: C.danger, fontWeight: '600', fontFamily: 'Nunito_600SemiBold' }}>Keluar dari Workspace</Text>
              </TouchableOpacity>
            )}
          </>
        )}


        {/* Invites tab */}
        {tab === 'invites' && (
          <>
            {invitesLoading ? (
              <ActivityIndicator color={C.primary} style={{ marginTop: 32 }} />
            ) : (invites ?? []).length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <Text style={{ fontSize: 36 }}>✉️</Text>
                <Text style={{ color: C.fg4, marginTop: 12, fontFamily: 'Nunito_500Medium' }}>Tidak ada undangan aktif</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: C.surface, borderRadius: 20, overflow: 'hidden' }}>
                {(invites ?? []).map((inv, idx) => (
                  <View key={inv.id}>
                    <View style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: C.mustardSoft }}>
                        <Text style={{ fontSize: 16 }}>✉️</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.fg1, fontWeight: '600', fontSize: 13, fontFamily: 'Nunito_600SemiBold' }}>{inv.email}</Text>
                        <Text style={{ color: C.fg4, fontSize: 11, fontFamily: 'Nunito_500Medium' }}>
                          Role: {roleLabel(inv.role)} · Exp: {format(new Date(inv.expiresAt), 'd MMM', { locale: id })}
                        </Text>
                      </View>
                      {canManage && (
                        <TouchableOpacity
                          onPress={() => revokeInviteMut.mutate(inv.id)}
                          style={{ width: 28, height: 28, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.dangerSoft }}
                        >
                          <Text style={{ fontSize: 12, color: C.danger }}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {idx < (invites ?? []).length - 1 && <View style={{ height: 1, backgroundColor: C.creamSunken, marginLeft: 64 }} />}
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Summary tab */}
        {tab === 'summary' && (
          <>
            {summaryLoading ? (
              <ActivityIndicator color={C.primary} style={{ marginTop: 32 }} />
            ) : (
              <>
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                  <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: 20, padding: 16 }}>
                    <Text style={{ fontSize: 11, color: C.fg4, fontWeight: '500', fontFamily: 'Nunito_500Medium' }}>Pemasukan</Text>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: C.primary, marginTop: 4, fontFamily: 'Nunito_700Bold' }}>{formatCurrency(summary?.totalIncome ?? 0)}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: 20, padding: 16 }}>
                    <Text style={{ fontSize: 11, color: C.fg4, fontWeight: '500', fontFamily: 'Nunito_500Medium' }}>Pengeluaran</Text>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: C.accent, marginTop: 4, fontFamily: 'Nunito_700Bold' }}>{formatCurrency(summary?.totalExpense ?? 0)}</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: C.surface, borderRadius: 20, padding: 16, marginBottom: 16 }}>
                  <Text style={{ fontSize: 11, color: C.fg4, fontWeight: '500', fontFamily: 'Nunito_500Medium' }}>Net Balance</Text>
                  <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 4, fontFamily: 'Nunito_700Bold', color: (summary?.netBalance ?? 0) >= 0 ? C.primary : C.danger }}>
                    {formatCurrency(summary?.netBalance ?? 0)}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.fg4, marginTop: 4, fontFamily: 'Nunito_500Medium' }}>{summary?.transactionCount ?? 0} transaksi</Text>
                </View>
                {(categoryBreakdown ?? []).length > 0 && (
                  <View style={{ backgroundColor: C.surface, borderRadius: 20, padding: 16, marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: C.fg2, marginBottom: 12, fontFamily: 'Nunito_700Bold' }}>Top Kategori</Text>
                    {(categoryBreakdown ?? []).slice(0, 5).map((row: any) => {
                      const maxTotal = (categoryBreakdown ?? [])[0]?.total ?? 1
                      const pct = Math.round((row.total / maxTotal) * 100)
                      return (
                        <View key={row.categoryId ?? 'uncategorized'} style={{ marginBottom: 12 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 13, color: C.fg2, fontFamily: 'Nunito_500Medium' }}>{row.categoryIcon ?? '📦'} {row.categoryName ?? 'Lainnya'}</Text>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: C.fg2, fontFamily: 'Nunito_600SemiBold' }}>{formatCurrency(row.total)}</Text>
                          </View>
                          <View style={{ height: 8, backgroundColor: C.creamSunken, borderRadius: 999, overflow: 'hidden' }}>
                            <View style={{ height: '100%', backgroundColor: C.primary, borderRadius: 999, width: `${pct}%` }} />
                          </View>
                        </View>
                      )
                    })}
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* Transactions tab */}
        {tab === 'transactions' && (
          <>
            {wsTxLoading ? (
              <ActivityIndicator color={C.primary} style={{ marginTop: 32 }} />
            ) : (wsTxData?.data ?? []).length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <Text style={{ color: C.fg4, marginTop: 12, fontFamily: 'Nunito_500Medium' }}>Belum ada transaksi</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: C.surface, borderRadius: 20, overflow: 'hidden' }}>
                {(wsTxData?.data ?? []).map((tx: any, idx: number) => (
                  <View key={tx.id}>
                    <TransactionItem
                      transaction={tx}
                      showDate
                      memberName={tx.memberName}
                    />
                    {idx < (wsTxData?.data ?? []).length - 1 && (
                      <View style={{ height: 1, backgroundColor: C.creamSunken, marginLeft: 64 }} />
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <InviteModal visible={showInvite} wsId={ws.id} onClose={() => setShowInvite(false)} />
    </View>
  )
}


// ─── Pending Invite Banner ────────────────────────────────────────────────────
function PendingInviteBanner() {
  const C = useTheme()
  const qc = useQueryClient()

  const { data: pending } = useQuery({
    queryKey: ['ws-my-pending-invites'],
    queryFn: () => wsApi.myPendingInvites().then(r => r.data ?? []),
    refetchInterval: 10_000,
  })

  const acceptMut = useMutation({
    mutationFn: (token: string) => api.post('/workspaces/invites/accept', { token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] })
      qc.invalidateQueries({ queryKey: ['ws-my-pending-invites'] })
    },
  })

  const declineMut = useMutation({
    mutationFn: (token: string) => api.post('/workspaces/invites/decline', { token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ws-my-pending-invites'] }),
  })

  if (!pending || pending.length === 0) return null

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: C.fg2, marginBottom: 8, fontFamily: 'Nunito_700Bold' }}>Undangan Masuk</Text>
      {pending.map((inv) => (
        <View key={inv.id} style={{ borderRadius: 20, padding: 16, marginBottom: 8, backgroundColor: C.mustardSoft, borderWidth: 1, borderColor: C.mustard }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: 'rgba(217,164,65,0.2)' }}>
              <Text style={{ fontSize: 18 }}>✉️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.fg1, fontWeight: '600', fontSize: 13, fontFamily: 'Nunito_600SemiBold' }}>
                Undangan ke workspace
              </Text>
              <Text style={{ color: C.fg3, fontSize: 11, marginTop: 2, fontFamily: 'Nunito_500Medium' }}>
                Role: {roleLabel(inv.role)} · Exp: {format(new Date(inv.expiresAt), 'd MMM', { locale: id })}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
            <TouchableOpacity
              onPress={() => inv.token && acceptMut.mutate(inv.token)}
              disabled={acceptMut.isPending || !inv.token}
              style={{ flex: 1, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 10, alignItems: 'center' }}
            >
              {acceptMut.isPending
                ? <ActivityIndicator size="small" color="white" />
                : <Text style={{ color: C.surface, fontWeight: '700', fontSize: 13, fontFamily: 'Nunito_700Bold' }}>Terima</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => inv.token && declineMut.mutate(inv.token)}
              disabled={declineMut.isPending || !inv.token}
              style={{ flex: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center', backgroundColor: C.creamSunken }}
            >
              <Text style={{ color: C.fg2, fontWeight: '600', fontSize: 13, fontFamily: 'Nunito_600SemiBold' }}>Tolak</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function WorkspaceScreen() {
  const C = useTheme()
  const isPro = useIsProActive()
  const { isPending: subPending, isError: subError } = useSubscription()
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<Workspace | null>(null)

  const { data: workspaces, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => wsApi.list().then(r => r.data),
  })

  if (selected) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
        <WorkspaceDetail ws={selected} onBack={() => setSelected(null)} />
      </SafeAreaView>
    )
  }

  if (subPending && !subError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.primary} />
        </View>
      </SafeAreaView>
    )
  }

  if (!isPro) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{ width: 72, height: 72, borderRadius: 999, backgroundColor: C.mustardSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 32 }}>🔒</Text>
          </View>
          <Text style={{ fontSize: 11, fontWeight: '800', color: C.accent, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'Nunito_800ExtraBold', marginBottom: 6 }}>Fitur Pro</Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: C.fg1, fontFamily: 'Nunito_900Black', textAlign: 'center', marginBottom: 8 }}>Workspace Bersama</Text>
          <Text style={{ fontSize: 13, color: C.fg3, textAlign: 'center', lineHeight: 20, fontFamily: 'Nunito_500Medium', marginBottom: 24 }}>
            {'Kelola keuangan bersama keluarga atau tim.\nFitur ini tersedia di paket Pro.'}
          </Text>
          <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 16, width: '100%', marginBottom: 24, gap: 10 }}>
            {[
              ['👥', 'Workspace hingga 5 anggota keluarga'],
              ['🛡', 'Role: Owner, Admin, Kontributor, Viewer'],
              ['📊', 'Laporan keuangan gabungan'],
              ['📨', 'Undang anggota via email'],
            ].map(([icon, label]) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{icon}</Text>
                <Text style={{ fontSize: 13, color: C.fg2, fontFamily: 'Nunito_600SemiBold' }}>{label}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/settings?section=billing' as any)}
            style={{ backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 36, width: '100%', alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, fontFamily: 'Nunito_800ExtraBold' }}>Lihat Paket Pro →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, alignSelf: 'flex-start' }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ fontSize: 22, color: C.primary, lineHeight: 26 }}>‹</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', marginLeft: 2, color: C.primary, fontFamily: 'Nunito_600SemiBold' }}>Kembali</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <View>
              <Text style={{ fontSize: 24, fontWeight: '700', color: C.fg1, fontFamily: 'Nunito_700Bold' }}>Workspace</Text>
              <Text style={{ color: C.fg4, fontSize: 13, marginTop: 2, fontFamily: 'Nunito_500Medium' }}>Kelola keuangan bersama</Text>
            </View>
            {isPro && (
              <TouchableOpacity
                onPress={() => setShowCreate(true)}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 }}
              >
                <Text style={{ fontSize: 16, color: C.surface, lineHeight: 20, marginRight: 4 }}>+</Text>
                <Text style={{ color: C.surface, fontWeight: '600', fontSize: 13, fontFamily: 'Nunito_600SemiBold' }}>Buat</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Pending invitations for current user */}
          <PendingInviteBanner />

          {/* Info card */}
          <View style={{ backgroundColor: C.primarySoft, borderWidth: 1, borderColor: '#C2D4B9', borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <Text style={{ color: '#2F4338', fontSize: 13, fontWeight: '700', marginBottom: 4, fontFamily: 'Nunito_700Bold' }}>Apa itu Workspace?</Text>
            <Text style={{ color: C.heroEnd, fontSize: 12, lineHeight: 18, fontFamily: 'Nunito_500Medium' }}>
              Workspace memungkinkan kamu berbagi data keuangan dengan keluarga atau tim bisnis.
              Setiap anggota punya role berbeda — owner, admin, kontributor, atau viewer.
            </Text>
          </View>

          {isLoading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color={C.primary} />
            </View>
          ) : (workspaces ?? []).length === 0 ? (
            <View style={{ backgroundColor: C.surface, borderRadius: 20, padding: 32, alignItems: 'center' }}>
              <Text style={{ fontSize: 40 }}>👥</Text>
              <Text style={{ color: C.fg3, fontWeight: '600', marginTop: 12, fontFamily: 'Nunito_600SemiBold' }}>Belum ada workspace</Text>
              <Text style={{ color: C.fg4, fontSize: 13, marginTop: 4, textAlign: 'center', fontFamily: 'Nunito_500Medium' }}>
                Buat workspace untuk berbagi keuangan dengan keluarga atau bisnis
              </Text>
              {isPro ? (
                <TouchableOpacity
                  onPress={() => setShowCreate(true)}
                  style={{ marginTop: 16, backgroundColor: C.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}
                >
                  <Text style={{ color: C.surface, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>Buat Workspace Pertama</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/settings?section=billing' as any)}
                  style={{ marginTop: 16, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: C.mustard }}
                >
                  <Text style={{ color: C.surface, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>Upgrade Pro untuk Membuat →</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {(workspaces ?? []).map((ws) => (
                <TouchableOpacity
                  key={ws.id}
                  onPress={() => setSelected(ws)}
                  style={{ backgroundColor: C.surface, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.divider }}
                >
                  <View style={{ width: 48, height: 48, backgroundColor: 'rgba(107,142,107,0.1)', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                    <Text style={{ fontSize: 22 }}>{ws.tier === 'family' ? '👨‍👩‍👧' : '💼'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.fg1, fontWeight: '700', fontSize: 16, fontFamily: 'Nunito_700Bold' }}>{ws.name}</Text>
                    {ws.description ? (
                      <Text style={{ color: C.fg4, fontSize: 11, marginTop: 2, fontFamily: 'Nunito_500Medium' }} numberOfLines={1}>{ws.description}</Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                      <View style={{ backgroundColor: C.creamSunken, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                        <Text style={{ color: C.fg3, fontSize: 11, fontFamily: 'Nunito_500Medium' }}>{ws.tier}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={{ fontSize: 18, color: C.fg4 }}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={{ height: 24 }} />
        </View>
      </ScrollView>

      <CreateWorkspaceModal visible={showCreate} onClose={() => setShowCreate(false)} />
    </SafeAreaView>
  )
}
