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
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { TransactionItem } from '../../components/transactions/TransactionItem'
import { formatCurrency } from '../../src/lib/format'

// ─── Types ───────────────────────────────────────────────────────────────────
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
  if (role === 'owner') return <Text style={{ fontSize: 14 }}>👑</Text>
  if (role === 'admin') return <Text style={{ fontSize: 14 }}>🛡</Text>
  if (role === 'contributor') return <Text style={{ fontSize: 14 }}>✎</Text>
  return <Text style={{ fontSize: 14, color: '#A8A39B' }}>👁</Text>
}

function roleLabel(role: string) {
  return { owner: 'Owner', admin: 'Admin', contributor: 'Kontributor', viewer: 'Viewer' }[role] ?? role
}

// ─── Create Workspace Modal ───────────────────────────────────────────────────
function CreateWorkspaceModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-white rounded-t-3xl p-6">
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-xl font-bold text-ink-900">Buat Workspace Baru</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 20, color: '#A8A39B', lineHeight: 24 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={{ backgroundColor: 'rgba(198,107,107,0.1)', borderWidth: 1, borderColor: '#C66B6B', borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: '#C66B6B', fontSize: 13, textAlign: 'center' }}>{error}</Text>
            </View>
          ) : null}

          <Text className="text-sm font-semibold text-ink-700 mb-2">Jenis Workspace</Text>
          <View className="flex-row gap-3 mb-4">
            {[
              { v: 'family',   label: 'Keluarga', icon: '👨‍👩‍👧' },
              { v: 'business', label: 'Bisnis',   icon: '💼' },
            ].map((t) => (
              <TouchableOpacity
                key={t.v}
                onPress={() => setTier(t.v as any)}
                className={`flex-1 p-3.5 rounded-xl items-center border ${
                  tier === t.v ? 'bg-primary/5 border-primary' : 'bg-canvas-200 border-border'
                }`}
              >
                <Text style={{ fontSize: 24 }}>{t.icon}</Text>
                <Text className={`text-sm font-semibold mt-1.5 ${tier === t.v ? 'text-primary' : 'text-ink-600'}`}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-sm font-semibold text-ink-700 mb-2">Nama Workspace</Text>
          <TextInput
            className="bg-canvas-200 border border-border rounded-xl px-4 py-3.5 text-ink-900 mb-3"
            placeholder="Contoh: Keuangan Keluarga"
            placeholderTextColor="#A8A39B"
            value={name}
            onChangeText={setName}
          />

          <Text className="text-sm font-semibold text-ink-700 mb-2">Deskripsi (opsional)</Text>
          <TextInput
            className="bg-canvas-200 border border-border rounded-xl px-4 py-3 text-ink-900 mb-5"
            placeholder="Untuk apa workspace ini..."
            placeholderTextColor="#A8A39B"
            value={desc}
            onChangeText={setDesc}
            multiline
            numberOfLines={2}
          />

          <TouchableOpacity
            onPress={() => { setError(''); mutation.mutate() }}
            disabled={mutation.isPending || !name.trim()}
            className={`rounded-xl py-4 items-center ${
              !name.trim() || mutation.isPending ? 'bg-primary/50' : 'bg-primary'
            }`}
          >
            {mutation.isPending
              ? <ActivityIndicator color="white" />
              : <Text className="text-white font-bold text-base">Buat Workspace</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────
function InviteModal({ visible, wsId, onClose }: { visible: boolean; wsId: string; onClose: () => void }) {
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
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-white rounded-t-3xl p-6">
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-xl font-bold text-ink-900">Undang Anggota</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 20, color: '#A8A39B', lineHeight: 24 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={{ backgroundColor: 'rgba(198,107,107,0.1)', borderWidth: 1, borderColor: '#C66B6B', borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <Text style={{ color: '#C66B6B', fontSize: 13, textAlign: 'center' }}>{error}</Text>
            </View>
          ) : null}
          {success ? (
            <View style={{ backgroundColor: '#DEE8D7', borderWidth: 1, borderColor: '#C2D4B9', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: '#41594F', marginRight: 8 }}>✓</Text>
              <Text style={{ color: '#41594F', fontSize: 13, flex: 1 }}>{success}</Text>
            </View>
          ) : null}

          <Text className="text-sm font-semibold text-ink-700 mb-2">Email</Text>
          <View className="flex-row items-center bg-canvas-200 border border-border rounded-xl px-4 mb-4">
            <Text style={{ fontSize: 16, color: '#A8A39B' }}>✉️</Text>
            <TextInput
              className="flex-1 ml-3 py-3.5 text-ink-900"
              placeholder="email@contoh.com"
              placeholderTextColor="#A8A39B"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <Text className="text-sm font-semibold text-ink-700 mb-2">Role</Text>
          <View className="gap-2 mb-5">
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r.value}
                onPress={() => setRole(r.value)}
                className={`flex-row items-center p-3.5 rounded-xl border ${
                  role === r.value ? 'bg-primary/5 border-primary' : 'bg-canvas-200 border-border'
                }`}
              >
                <Text style={{ fontSize: 16 }}>{r.icon}</Text>
                <View className="flex-1 ml-3">
                  <Text className={`font-semibold text-sm ${role === r.value ? 'text-primary' : 'text-ink-700'}`}>
                    {r.label}
                  </Text>
                  <Text className="text-xs text-ink-400">{r.desc}</Text>
                </View>
                {role === r.value && <View className="w-2 h-2 rounded-full bg-primary" />}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => { setError(''); setSuccess(''); mutation.mutate() }}
            disabled={mutation.isPending || !email.trim()}
            className={`rounded-xl py-4 items-center ${
              !email.trim() || mutation.isPending ? 'bg-primary/50' : 'bg-primary'
            }`}
          >
            {mutation.isPending
              ? <ActivityIndicator color="white" />
              : <Text className="text-white font-bold">Kirim Undangan</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ─── Workspace Detail ─────────────────────────────────────────────────────────
function WorkspaceDetail({ ws, onBack }: { ws: Workspace; onBack: () => void }) {
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
    <View className="flex-1">
      {/* Header */}
      <View className="bg-primary px-5 pt-4 pb-6">
        <TouchableOpacity onPress={onBack} className="flex-row items-center mb-3">
          <Text style={{ fontSize: 20, color: 'rgba(255,255,255,0.7)', lineHeight: 24 }}>‹</Text>
          <Text className="text-white/70 text-sm ml-1">Workspace</Text>
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">{ws.name}</Text>
        {ws.description ? (
          <Text className="text-white/60 text-sm mt-1">{ws.description}</Text>
        ) : null}
        <View className="flex-row items-center mt-2">
          <View className="bg-white/15 px-2.5 py-1 rounded-full flex-row items-center">
            <Text style={{ fontSize: 12 }}>👥</Text>
            <Text className="text-white/80 text-xs ml-1.5 font-medium">
              {members?.length ?? 0} anggota
            </Text>
          </View>
          <View className="bg-white/15 px-2.5 py-1 rounded-full ml-2">
            <Text className="text-white/80 text-xs font-medium capitalize">{ws.tier}</Text>
          </View>
          <View className="bg-white/15 px-2.5 py-1 rounded-full ml-2">
            <Text className="text-white/80 text-xs font-medium">{myRole === 'owner' ? '👑 Owner' : roleLabel(myRole)}</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row bg-white px-4" style={{ borderBottomWidth: 1, borderBottomColor: '#ECE4D3' }}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            className={`py-3.5 mr-6 border-b-2 ${tab === t.key ? 'border-primary' : 'border-transparent'}`}
          >
            <Text className={`text-sm font-semibold ${tab === t.key ? 'text-primary' : 'text-ink-400'}`}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        {/* Members tab */}
        {tab === 'members' && (
          <>
            {canManage && (
              <TouchableOpacity
                onPress={() => setShowInvite(true)}
                className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-4 flex-row items-center"
              >
                <View className="w-10 h-10 bg-primary/10 rounded-xl items-center justify-center mr-3">
                  <Text style={{ fontSize: 20 }}>👤</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-primary font-semibold">Undang Anggota Baru</Text>
                  <Text className="text-ink-400 text-xs mt-0.5">Kirim undangan via email</Text>
                </View>
                <Text style={{ fontSize: 18, color: '#6B8E6B' }}>›</Text>
              </TouchableOpacity>
            )}

            {membersLoading ? (
              <ActivityIndicator color="#6B8E6B" style={{ marginTop: 32 }} />
            ) : (
              <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
                {(members ?? []).map((m, idx) => (
                  <View key={m.userId}>
                    <View className="px-4 py-3.5 flex-row items-center">
                      <View className="w-10 h-10 bg-primary/10 rounded-full items-center justify-center mr-3">
                        <Text className="text-primary font-bold text-base">
                          {m.name?.charAt(0)?.toUpperCase() ?? '?'}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <Text className="text-ink-800 font-semibold text-sm">{m.name}</Text>
                          {m.userId === currentUser?.id && (
                            <Text className="text-ink-400 text-xs ml-1.5">(kamu)</Text>
                          )}
                        </View>
                        <Text className="text-ink-400 text-xs">{m.email}</Text>
                      </View>
                      <View className="flex-row items-center">
                        <RoleIcon role={m.role} />
                        <Text className="text-ink-500 text-xs ml-1 mr-2">{roleLabel(m.role)}</Text>
                        {canManage && m.role !== 'owner' && m.userId !== currentUser?.id && (
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert('Keluarkan Anggota', `Keluarkan ${m.name} dari workspace?`, [
                                { text: 'Batal', style: 'cancel' },
                                { text: 'Keluarkan', style: 'destructive', onPress: () => removeMut.mutate(m.userId) },
                              ])
                            }}
                            className="w-7 h-7 rounded-lg items-center justify-center"
                            style={{ backgroundColor: 'rgba(198,107,107,0.1)' }}
                          >
                            <Text style={{ fontSize: 12, color: '#C66B6B' }}>✕</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    {idx < (members ?? []).length - 1 && <View className="h-px bg-canvas-200 ml-16" />}
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
                className="mt-4 rounded-2xl p-4 flex-row items-center justify-center mb-6"
                style={{ backgroundColor: 'rgba(198,107,107,0.08)', borderWidth: 1, borderColor: 'rgba(198,107,107,0.2)' }}
              >
                <Text style={{ fontSize: 16, marginRight: 8 }}>↗</Text>
                <Text style={{ color: '#C66B6B', fontWeight: '600' }}>Keluar dari Workspace</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Invites tab */}
        {tab === 'invites' && (
          <>
            {invitesLoading ? (
              <ActivityIndicator color="#6B8E6B" style={{ marginTop: 32 }} />
            ) : (invites ?? []).length === 0 ? (
              <View className="py-10 items-center">
                <Text style={{ fontSize: 36 }}>✉️</Text>
                <Text className="text-ink-400 mt-3">Tidak ada undangan aktif</Text>
              </View>
            ) : (
              <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
                {(invites ?? []).map((inv, idx) => (
                  <View key={inv.id}>
                    <View className="px-4 py-3.5 flex-row items-center">
                      <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: '#FBEFD2' }}>
                        <Text style={{ fontSize: 16 }}>✉️</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-ink-800 font-semibold text-sm">{inv.email}</Text>
                        <Text className="text-ink-400 text-xs">
                          Role: {roleLabel(inv.role)} · Exp: {format(new Date(inv.expiresAt), 'd MMM', { locale: id })}
                        </Text>
                      </View>
                      {canManage && (
                        <TouchableOpacity
                          onPress={() => revokeInviteMut.mutate(inv.id)}
                          className="w-7 h-7 rounded-lg items-center justify-center"
                          style={{ backgroundColor: 'rgba(198,107,107,0.1)' }}
                        >
                          <Text style={{ fontSize: 12, color: '#C66B6B' }}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {idx < (invites ?? []).length - 1 && <View className="h-px bg-canvas-200 ml-16" />}
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
              <ActivityIndicator color="#6B8E6B" style={{ marginTop: 32 }} />
            ) : (
              <>
                <View className="flex-row gap-3 mb-4">
                  <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm">
                    <Text className="text-xs text-ink-400 font-medium">Pemasukan</Text>
                    <Text className="text-lg font-bold text-primary mt-1">{formatCurrency(summary?.totalIncome ?? 0)}</Text>
                  </View>
                  <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm">
                    <Text className="text-xs text-ink-400 font-medium">Pengeluaran</Text>
                    <Text className="text-lg font-bold text-accent mt-1">{formatCurrency(summary?.totalExpense ?? 0)}</Text>
                  </View>
                </View>
                <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
                  <Text className="text-xs text-ink-400 font-medium">Net Balance</Text>
                  <Text className={`text-xl font-bold mt-1 ${(summary?.netBalance ?? 0) >= 0 ? 'text-primary' : ''}`}
                    style={(summary?.netBalance ?? 0) < 0 ? { color: '#C66B6B' } : undefined}>
                    {formatCurrency(summary?.netBalance ?? 0)}
                  </Text>
                  <Text className="text-xs text-ink-400 mt-1">{summary?.transactionCount ?? 0} transaksi</Text>
                </View>
                {(categoryBreakdown ?? []).length > 0 && (
                  <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
                    <Text className="text-sm font-bold text-ink-700 mb-3">Top Kategori</Text>
                    {(categoryBreakdown ?? []).slice(0, 5).map((row: any) => {
                      const maxTotal = (categoryBreakdown ?? [])[0]?.total ?? 1
                      const pct = Math.round((row.total / maxTotal) * 100)
                      return (
                        <View key={row.categoryId ?? 'uncategorized'} className="mb-3">
                          <View className="flex-row justify-between mb-1">
                            <Text className="text-sm text-ink-700">{row.categoryIcon ?? '📦'} {row.categoryName ?? 'Lainnya'}</Text>
                            <Text className="text-sm font-semibold text-ink-700">{formatCurrency(row.total)}</Text>
                          </View>
                          <View className="h-2 bg-canvas-200 rounded-full overflow-hidden">
                            <View className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
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
              <ActivityIndicator color="#6B8E6B" style={{ marginTop: 32 }} />
            ) : (wsTxData?.data ?? []).length === 0 ? (
              <View className="py-10 items-center">
                <Text className="text-ink-400 mt-3">Belum ada transaksi</Text>
              </View>
            ) : (
              <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
                {(wsTxData?.data ?? []).map((tx: any, idx: number) => (
                  <View key={tx.id}>
                    <TransactionItem
                      transaction={tx}
                      showDate
                      memberName={tx.memberName}
                    />
                    {idx < (wsTxData?.data ?? []).length - 1 && (
                      <View className="h-px bg-canvas-200 ml-16" />
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <View className="h-6" />
      </ScrollView>

      <InviteModal visible={showInvite} wsId={ws.id} onClose={() => setShowInvite(false)} />
    </View>
  )
}

// ─── Pending Invite Banner ────────────────────────────────────────────────────
function PendingInviteBanner() {
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
    <View className="mb-5">
      <Text className="text-sm font-bold text-ink-700 mb-2">Undangan Masuk</Text>
      {pending.map((inv) => (
        <View key={inv.id} className="rounded-2xl p-4 mb-2" style={{ backgroundColor: '#FBEFD2', borderWidth: 1, borderColor: '#D9A441' }}>
          <View className="flex-row items-start">
            <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: 'rgba(217,164,65,0.2)' }}>
              <Text style={{ fontSize: 18 }}>✉️</Text>
            </View>
            <View className="flex-1">
              <Text className="text-ink-800 font-semibold text-sm">
                Undangan ke workspace
              </Text>
              <Text className="text-ink-500 text-xs mt-0.5">
                Role: {roleLabel(inv.role)} · Exp: {format(new Date(inv.expiresAt), 'd MMM', { locale: id })}
              </Text>
            </View>
          </View>
          <View className="flex-row mt-3 gap-2">
            <TouchableOpacity
              onPress={() => inv.token && acceptMut.mutate(inv.token)}
              disabled={acceptMut.isPending || !inv.token}
              className="flex-1 bg-primary rounded-xl py-2.5 items-center"
            >
              {acceptMut.isPending
                ? <ActivityIndicator size="small" color="white" />
                : <Text className="text-white font-bold text-sm">Terima</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => inv.token && declineMut.mutate(inv.token)}
              disabled={declineMut.isPending || !inv.token}
              className="flex-1 rounded-xl py-2.5 items-center bg-canvas-200"
            >
              <Text className="text-ink-600 font-semibold text-sm">Tolak</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function WorkspaceScreen() {
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<Workspace | null>(null)

  const { data: workspaces, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => wsApi.list().then(r => r.data),
  })

  if (selected) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
        <WorkspaceDetail ws={selected} onBack={() => setSelected(null)} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-5">
          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row items-center mb-4 self-start"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ fontSize: 22, color: '#6B8E6B', lineHeight: 26 }}>‹</Text>
            <Text className="text-sm font-semibold ml-0.5" style={{ color: '#6B8E6B' }}>Kembali</Text>
          </TouchableOpacity>
          <View className="flex-row items-center justify-between mb-5">
            <View>
              <Text className="text-2xl font-bold text-ink-900">Workspace</Text>
              <Text className="text-ink-400 text-sm mt-0.5">Kelola keuangan bersama</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowCreate(true)}
              className="flex-row items-center bg-primary rounded-xl px-4 py-2.5"
            >
              <Text style={{ fontSize: 16, color: 'white', lineHeight: 20, marginRight: 4 }}>+</Text>
              <Text className="text-white font-semibold text-sm">Buat</Text>
            </TouchableOpacity>
          </View>

          {/* Pending invitations for current user */}
          <PendingInviteBanner />

          {/* Info card */}
          <View style={{ backgroundColor: '#DEE8D7', borderWidth: 1, borderColor: '#C2D4B9', borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <Text style={{ color: '#2F4338', fontSize: 13, fontWeight: '700', marginBottom: 4 }}>Apa itu Workspace?</Text>
            <Text style={{ color: '#41594F', fontSize: 12, lineHeight: 18 }}>
              Workspace memungkinkan kamu berbagi data keuangan dengan keluarga atau tim bisnis.
              Setiap anggota punya role berbeda — owner, admin, kontributor, atau viewer.
            </Text>
          </View>

          {isLoading ? (
            <View className="py-10 items-center">
              <ActivityIndicator color="#6B8E6B" />
            </View>
          ) : (workspaces ?? []).length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center shadow-sm">
              <Text style={{ fontSize: 40 }}>👥</Text>
              <Text className="text-ink-500 font-semibold mt-3">Belum ada workspace</Text>
              <Text className="text-ink-400 text-sm mt-1 text-center">
                Buat workspace untuk berbagi keuangan dengan keluarga atau bisnis
              </Text>
              <TouchableOpacity
                onPress={() => setShowCreate(true)}
                className="mt-4 bg-primary rounded-xl px-6 py-3"
              >
                <Text className="text-white font-bold">Buat Workspace Pertama</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="gap-3">
              {(workspaces ?? []).map((ws) => (
                <TouchableOpacity
                  key={ws.id}
                  onPress={() => setSelected(ws)}
                  className="bg-white rounded-2xl p-4 shadow-sm flex-row items-center"
                  style={{ borderWidth: 1, borderColor: '#ECE4D3' }}
                >
                  <View className="w-12 h-12 bg-primary/10 rounded-xl items-center justify-center mr-4">
                    <Text style={{ fontSize: 22 }}>{ws.tier === 'family' ? '👨‍👩‍👧' : '💼'}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-ink-900 font-bold text-base">{ws.name}</Text>
                    {ws.description ? (
                      <Text className="text-ink-400 text-xs mt-0.5" numberOfLines={1}>{ws.description}</Text>
                    ) : null}
                    <View className="flex-row items-center mt-1.5">
                      <View className="bg-canvas-200 px-2 py-0.5 rounded-full">
                        <Text className="text-ink-500 text-xs capitalize">{ws.tier}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={{ fontSize: 18, color: '#A8A39B' }}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View className="h-6" />
        </View>
      </ScrollView>

      <CreateWorkspaceModal visible={showCreate} onClose={() => setShowCreate(false)} />
    </SafeAreaView>
  )
}
