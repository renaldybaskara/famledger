import { View, Text, TouchableOpacity } from 'react-native'
import { useTrialDaysLeft, useSubscription } from '../hooks/useSubscription'

const C = {
  primary: '#6B8E6B',
  accent:  '#C97B5C',
  mustard: '#D9A441',
  mustardSoft: '#FBEFD2',
  fg1: '#2D2A26',
  fg2: '#55504A',
}

interface TrialBannerProps {
  onUpgrade: () => void
}

export function TrialBanner({ onUpgrade }: TrialBannerProps) {
  const { data: sub } = useSubscription()
  const daysLeft = useTrialDaysLeft()

  if (!sub || sub.status !== 'trialing' || daysLeft === null) return null

  const urgent = daysLeft <= 3
  const bg     = urgent ? '#FFF3E0' : C.mustardSoft
  const border = urgent ? '#E8A44A' : '#EAD18A'
  const icon   = urgent ? '⚡' : '✨'
  const color  = urgent ? '#B45309' : '#7A5C1E'

  return (
    <View style={{
      backgroundColor: bg,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 11,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 16,
      marginBottom: 12,
    }}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color, fontFamily: 'Nunito_800ExtraBold' }}>
          {daysLeft === 0 ? 'Trial berakhir hari ini!' : `${daysLeft} hari tersisa di trial Pro`}
        </Text>
        <Text style={{ fontSize: 11, color, fontFamily: 'Nunito_500Medium', marginTop: 1, opacity: 0.8 }}>
          Upgrade sekarang agar auto-import email tidak terhenti
        </Text>
      </View>
      <TouchableOpacity
        onPress={onUpgrade}
        style={{
          backgroundColor: urgent ? C.accent : C.mustard,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 7,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', fontFamily: 'Nunito_800ExtraBold' }}>
          Upgrade
        </Text>
      </TouchableOpacity>
    </View>
  )
}
