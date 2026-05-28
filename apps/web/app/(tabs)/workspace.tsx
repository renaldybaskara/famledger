import { useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Modal, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Users, Crown, Shield, Eye, Edit2, Trash2,
  X, Mail, ChevronRight, UserPlus, LogOut, Clock, Check,
} from 'lucide-react'
import { api } from '../../src/lib/api'
import { useAuthStore } from '../../src/store/auth.store'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

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
}

// ─── Role config ─────────────────────────────────────────────────────────────
const ROLES = [
  { value: 'admin',       label: 'Admin',       icon: Shield,  desc: 'Undang member, ubah role' },
  { value: 'contributor', label: 'Kontributor', icon: Edit2,   desc: 'Tambah & edit transaksi' },
  { value: 'viewer',      label: 'Viewer',      icon: Eye,     desc: 'Hanya lihat data' },
]

function RoleIcon({ role }: { role: string }) {
  if (role === 'owner') return <Crown size={14} color="#f59e0b" />
  if (role === 'admin') return <Shield size={14} color="#3b82f6" />
  if (role === 'contributor') return <Edit2 size={14} color="#10b981" />
  return <Eye size={14} color="#94a3b8" />
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
            <Text className="text-xl font-bold text-slate-900">Buat Workspace Baru</Text>
            <TouchableOpacity onPress={onClose}><X size={22} color="#94a3b8" /></TouchableOpacity>
          </View>

          {error ? (
            <View className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <Text className="text-red-600 text-sm text-center">{error}</Text>
            </View>
          ) : null}

          <Text className="text-sm font-semibold text-slate-700 mb-2">Jenis Workspace</Text>
          <View className="flex-row gap-3 mb-4">
            {[
              { v: 'family',   label: 'Keluarga', icon: '👨‍👩‍👧' },
              { v: 'business', label: 'Bisnis',   icon: '💼' },
            ].map((t) => (
              <TouchableOpacity
                key={t.v}
                onPress={() => setTier(t.v as any)}
                className={`flex-1 p-3.5 rounded-xl items-center border ${
                  tier === t.v ? 'bg-primary/5 border-primary' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <Text style={{ fontSize: 24 }}>{t.icon}</Text>
                <Text className={`text-sm font-semibold mt-1.5 ${tier === t.v ? 'text-primary' : 'text-slate-600'}`}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-sm font-semibold text-slate-700 mb-2">Nama Workspace</Text>
          <TextInput
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 mb-3"
            placeholder="Contoh: Keuangan Keluarga"
            placeholderTextColor="#94a3b8"
            value={name}
            onChangeText={setName}
          />

          <Text className="text-sm font-semibold text-slate-700 mb-2">Deskripsi (opsional)</Text>
          <TextInput
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 mb-5"
            placeholder="Untuk apa workspace ini..."
            placeholderTextColor="#94a3b8"
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
            <Text className="text-xl font-bold text-slate-900">Undang Anggota</Text>
            <TouchableOpacity onPress={onClose}><X size={22} color="#94a3b8" /></TouchableOpacity>
          </View>

          {error ? (
            <View className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
              <Text className="text-red-600 text-sm text-center">{error}</Text>
            </View>
          ) : null}
          {success ? (
            <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3 flex-row items-center">
              <Check size={14} color="#10b981" />
              <Text className="text-emerald-700 text-sm ml-2">{success}</Text>
            </View>
          ) : null}

          <Text className="text-sm font-semibold text-slate-700 mb-2">Email</Text>
          <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4 mb-4">
            <Mail size={16} color="#94a3b8" />
            <TextInput
              className="flex-1 ml-3 py-3.5 text-slate-900"
              placeholder="email@contoh.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <Text className="text-sm font-semibold text-slate-700 mb-2">Role</Text>
          <View className="gap-2 mb-5">
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r.value}
                onPress={() => setRole(r.value)}
                className={`flex-row items-center p-3.5 rounded-xl border ${
                  role === r.value ? 'bg-primary/5 border-primary' : 'bg-slate-50 border-slate-100'
                }`}
              >
                <r.icon size={16} color={role === r.value ? '#1A2B4A' : '#94a3b8'} />
                <View className="flex-1 ml-3">
                  <Text className={`font-semibold text-sm ${role === r.value ? 'text-primary' : 'text-slate-700'}`}>
                    {r.label}
                  </Text>
                  <Text className="text-xs text-slate-400">{r.desc}</Text>
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
  const [tab, setTab] = useState<'members' | 'invites' | 'activity'>('members')
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

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['ws-activity', ws.id],
    queryFn: () => wsApi.activity(ws.id).then(r => r.data),
    enabled: tab === 'activity',
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
    { key: 'members',  label: 'Anggota' },
    { key: 'invites',  label: 'Undangan' },
    { key: 'activity', label: 'Aktivitas' },
  ] as const

  return (
    <View className="flex-1">
      {/* Header */}
      <View className="bg-primary px-5 pt-4 pb-6">
        <TouchableOpacity onPress={onBack} className="flex-row items-center mb-3">
          <ChevronRight size={18} color="rgba(255,255,255,0.7)" style={{ transform: [{ rotate: '180deg' }] }} />
          <Text className="text-white/70 text-sm ml-1">Workspace</Text>
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">{ws.name}</Text>
        {ws.description ? (
          <Text className="text-white/60 text-sm mt-1">{ws.description}</Text>
        ) : null}
        <View className="flex-row items-center mt-2">
          <View className="bg-white/15 px-2.5 py-1 rounded-full flex-row items-center">
            <Users size={12} color="rgba(255,255,255,0.8)" />
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
      <View className="flex-row bg-white border-b border-slate-100 px-4">
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            className={`py-3.5 mr-6 border-b-2 ${tab === t.key ? 'border-primary' : 'border-transparent'}`}
          >
            <Text className={`text-sm font-semibold ${tab === t.key ? 'text-primary' : 'text-slate-400'}`}>
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
                  <UserPlus size={18} color="#1A2B4A" />
                </View>
                <View className="flex-1">
                  <Text className="text-primary font-semibold">Undang Anggota Baru</Text>
                  <Text className="text-slate-400 text-xs mt-0.5">Kirim undangan via email</Text>
                </View>
                <ChevronRight size={16} color="#1A2B4A" />
              </TouchableOpacity>
            )}

            {membersLoading ? (
              <ActivityIndicator color="#1A2B4A" className="mt-8" />
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
                          <Text className="text-slate-800 font-semibold text-sm">{m.name}</Text>
                          {m.userId === currentUser?.id && (
                            <Text className="text-slate-400 text-xs ml-1.5">(kamu)</Text>
                          )}
                        </View>
                        <Text className="text-slate-400 text-xs">{m.email}</Text>
                      </View>
                      <View className="flex-row items-center">
                        <RoleIcon role={m.role} />
                        <Text className="text-slate-500 text-xs ml-1 mr-2">{roleLabel(m.role)}</Text>
                        {canManage && m.role !== 'owner' && m.userId !== currentUser?.id && (
                          <TouchableOpacity
                            onPress={() => {
                              if (typeof window !== 'undefined') {
                                if (window.confirm(`Keluarkan ${m.name} dari workspace?`)) {
                                  removeMut.mutate(m.userId)
                                }
                              }
                            }}
                            className="w-7 h-7 bg-red-50 rounded-lg items-center justify-center"
                          >
                            <Trash2 size={12} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    {idx < (members ?? []).length - 1 && <View className="h-px bg-slate-50 ml-16" />}
                  </View>
                ))}
              </View>
            )}

            {/* Leave workspace button */}
            {myRole !== 'owner' && (
              <TouchableOpacity
                onPress={() => {
                  if (typeof window !== 'undefined' && window.confirm('Keluar dari workspace ini?')) {
                    wsApi.leave(ws.id).then(() => {
                      qc.invalidateQueries({ queryKey: ['workspaces'] })
                      onBack()
                    })
                  }
                }}
                className="mt-4 bg-red-50 border border-red-100 rounded-2xl p-4 flex-row items-center justify-center mb-6"
              >
                <LogOut size={16} color="#ef4444" />
                <Text className="text-red-600 font-semibold ml-2">Keluar dari Workspace</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Invites tab */}
        {tab === 'invites' && (
          <>
            {invitesLoading ? (
              <ActivityIndicator color="#1A2B4A" className="mt-8" />
            ) : (invites ?? []).length === 0 ? (
              <View className="py-10 items-center">
                <Mail size={36} color="#cbd5e1" />
                <Text className="text-slate-400 mt-3">Tidak ada undangan aktif</Text>
              </View>
            ) : (
              <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
                {(invites ?? []).map((inv, idx) => (
                  <View key={inv.id}>
                    <View className="px-4 py-3.5 flex-row items-center">
                      <View className="w-10 h-10 bg-amber-50 rounded-full items-center justify-center mr-3">
                        <Mail size={16} color="#f59e0b" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-slate-800 font-semibold text-sm">{inv.email}</Text>
                        <Text className="text-slate-400 text-xs">
                          Role: {roleLabel(inv.role)} · Exp: {format(new Date(inv.expiresAt), 'd MMM', { locale: id })}
                        </Text>
                      </View>
                      {canManage && (
                        <TouchableOpacity
                          onPress={() => revokeInviteMut.mutate(inv.id)}
                          className="w-7 h-7 bg-red-50 rounded-lg items-center justify-center"
                        >
                          <X size={12} color="#ef4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                    {idx < (invites ?? []).length - 1 && <View className="h-px bg-slate-50 ml-16" />}
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Activity tab */}
        {tab === 'activity' && (
          <>
            {activityLoading ? (
              <ActivityIndicator color="#1A2B4A" className="mt-8" />
            ) : (activity ?? []).length === 0 ? (
              <View className="py-10 items-center">
                <Clock size={36} color="#cbd5e1" />
                <Text className="text-slate-400 mt-3">Belum ada aktivitas</Text>
              </View>
            ) : (
              <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
                {(activity ?? []).map((log, idx) => (
                  <View key={log.id}>
                    <View className="px-4 py-3.5 flex-row items-start">
                      <View className="w-8 h-8 bg-slate-100 rounded-full items-center justify-center mr-3 mt-0.5">
                        <Clock size={14} color="#94a3b8" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-slate-800 text-sm">
                          <Text className="font-semibold">{log.actorName}</Text>
                          {' '}{log.action}
                          {log.targetName ? <Text className="font-semibold"> {log.targetName}</Text> : null}
                        </Text>
                        <Text className="text-slate-400 text-xs mt-0.5">
                          {format(new Date(log.createdAt), 'd MMM yyyy HH:mm', { locale: id })}
                        </Text>
                      </View>
                    </View>
                    {idx < (activity ?? []).length - 1 && <View className="h-px bg-slate-50 ml-14" />}
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
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
        <WorkspaceDetail ws={selected} onBack={() => setSelected(null)} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-5">
          <View className="flex-row items-center justify-between mb-5">
            <View>
              <Text className="text-2xl font-bold text-slate-900">Workspace</Text>
              <Text className="text-slate-400 text-sm mt-0.5">Kelola keuangan bersama</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowCreate(true)}
              className="flex-row items-center bg-primary rounded-xl px-4 py-2.5"
            >
              <Plus size={16} color="white" />
              <Text className="text-white font-semibold text-sm ml-1.5">Buat</Text>
            </TouchableOpacity>
          </View>

          {/* Info card */}
          <View className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-5">
            <Text className="text-blue-800 text-sm font-semibold mb-1">Apa itu Workspace?</Text>
            <Text className="text-blue-600 text-xs leading-5">
              Workspace memungkinkan kamu berbagi data keuangan dengan keluarga atau tim bisnis.
              Setiap anggota punya role berbeda — owner, admin, kontributor, atau viewer.
            </Text>
          </View>

          {isLoading ? (
            <View className="py-10 items-center">
              <ActivityIndicator color="#1A2B4A" />
            </View>
          ) : (workspaces ?? []).length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center shadow-sm">
              <Users size={40} color="#cbd5e1" />
              <Text className="text-slate-500 font-semibold mt-3">Belum ada workspace</Text>
              <Text className="text-slate-400 text-sm mt-1 text-center">
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
                  className="bg-white rounded-2xl p-4 shadow-sm border border-slate-50 flex-row items-center"
                >
                  <View className="w-12 h-12 bg-primary/10 rounded-xl items-center justify-center mr-4">
                    <Text style={{ fontSize: 22 }}>{ws.tier === 'family' ? '👨‍👩‍👧' : '💼'}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-900 font-bold text-base">{ws.name}</Text>
                    {ws.description ? (
                      <Text className="text-slate-400 text-xs mt-0.5" numberOfLines={1}>{ws.description}</Text>
                    ) : null}
                    <View className="flex-row items-center mt-1.5">
                      <View className="bg-slate-100 px-2 py-0.5 rounded-full">
                        <Text className="text-slate-500 text-xs capitalize">{ws.tier}</Text>
                      </View>
                    </View>
                  </View>
                  <ChevronRight size={18} color="#94a3b8" />
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
