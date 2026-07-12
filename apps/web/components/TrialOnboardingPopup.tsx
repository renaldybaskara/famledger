import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { subscriptionApi } from '../src/lib/api'
import { useAuthStore } from '../src/store/auth.store'
import { useTheme } from '../src/lib/theme'

const BENEFITS = [
  ['✉️', 'Auto-import transaksi dari Gmail'],
  ['👥', 'Workspace keluarga hingga 5 anggota'],
  ['🤖', 'AI kategorisasi merchant otomatis'],
  ['🏦', 'Custom bank parser rules'],
  ['📊', 'Transaksi & budget tak terbatas'],
]

interface Props {
  visible: boolean
  onDismiss: () => void
}

export function TrialOnboardingPopup({ visible, onDismiss }: Props) {
  const C = useTheme()
  const [loading, setLoading] = useState(false)
  const qc = useQueryClient()
  const { setAuth, user, accessToken, refreshToken } = useAuthStore()

  const handleStartTrial = async () => {
    setLoading(true)
    try {
      await subscriptionApi.startTrial()
      // Refresh subscription query so useIsProActive picks up the new trialing status
      await qc.invalidateQueries({ queryKey: ['subscription'] })
      // Update local user tier so cached auth store reflects premium immediately
      if (user && accessToken && refreshToken) {
        setAuth({ ...user, tier: 'premium' }, accessToken, refreshToken)
      }
      onDismiss()
    } catch {
      // silently dismiss — backend is idempotent, worst case they retry
      onDismiss()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={{
        flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <View style={{
          backgroundColor: C.surface, borderRadius: 28, padding: 28,
          width: '100%', maxWidth: 400, gap: 16,
        }}>
          {/* Header */}
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 36 }}>✨</Text>
            <Text style={{ fontSize: 22, fontWeight: '900', color: C.fg1, fontFamily: 'Inter_900Black', textAlign: 'center' }}>
              Coba Budgetin Pro Gratis
            </Text>
            <View style={{ backgroundColor: C.mustardSoft, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 5 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#7A5C1E', fontFamily: 'Inter_800ExtraBold' }}>
                14 hari · tanpa kartu kredit
              </Text>
            </View>
          </View>

          {/* Benefits */}
          <View style={{ backgroundColor: C.cream, borderRadius: 16, padding: 16, gap: 10 }}>
            {BENEFITS.map(([icon, label]) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{icon}</Text>
                <Text style={{ fontSize: 13, color: C.fg2, flex: 1, fontFamily: 'Inter_600SemiBold' }}>{label}</Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity
            onPress={handleStartTrial}
            disabled={loading}
            style={{
              backgroundColor: C.primary, borderRadius: 16, paddingVertical: 15,
              alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', fontFamily: 'Inter_900Black' }}>
                  Mulai Trial Gratis →
                </Text>
            }
          </TouchableOpacity>

          {/* Dismiss */}
          <TouchableOpacity onPress={onDismiss} style={{ alignItems: 'center', paddingVertical: 4 }}>
            <Text style={{ fontSize: 13, color: C.fg3, fontFamily: 'Inter_500Medium' }}>
              Lanjutkan dengan paket gratis
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}
