import { View, Text, TouchableOpacity } from 'react-native'
import { useIsProActive } from '../hooks/useSubscription'
import { useTheme } from '../lib/theme'

interface ProGateProps {
  /** Feature name shown in the overlay, e.g. "Integrasi Email" */
  featureName: string
  /** Called when user taps the upgrade button */
  onUpgrade: () => void
  /** Content to render (blurred behind the gate when locked) */
  children: React.ReactNode
}

/**
 * Wraps a Pro-only feature. When the user is not Pro, shows a blurred
 * overlay with an upgrade prompt instead of the feature content.
 */
export function ProGate({ featureName, onUpgrade, children }: ProGateProps) {
  const isPro = useIsProActive()
  const C = useTheme()

  if (isPro) return <>{children}</>

  return (
    <View style={{ position: 'relative' }}>
      {/* Blurred/faded content preview */}
      <View style={{ opacity: 0.15, pointerEvents: 'none' } as any}>
        {children}
      </View>

      {/* Overlay */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: C.isDark ? `${C.cream}EB` : 'rgba(250,247,242,0.92)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        <View style={{
          backgroundColor: C.surface,
          borderRadius: 24,
          padding: 24,
          width: '100%',
          maxWidth: 360,
          alignItems: 'center',
          shadowColor: C.fg1,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 16,
          elevation: 8,
          gap: 8,
          borderWidth: C.isDark ? 1 : 0,
          borderColor: C.isDark ? C.border : 'transparent',
        }}>
          <View style={{
            width: 64, height: 64, borderRadius: 999,
            backgroundColor: C.mustardSoft,
            alignItems: 'center', justifyContent: 'center', marginBottom: 4,
          }}>
            <Text style={{ fontSize: 28 }}>🔒</Text>
          </View>

          <Text style={{ fontSize: 11, fontWeight: '800', color: C.accent, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'Nunito_800ExtraBold' }}>
            Fitur Pro
          </Text>
          <Text style={{ fontSize: 20, fontWeight: '900', color: C.fg1, fontFamily: 'Nunito_900Black', textAlign: 'center' }}>
            {featureName}
          </Text>
          <Text style={{ fontSize: 13, color: C.fg3, textAlign: 'center', lineHeight: 20, fontFamily: 'Nunito_500Medium', marginTop: 2 }}>
            Fitur ini tersedia di paket Pro Budgetin.{'\n'}
            Mulai dengan 14 hari trial gratis — tanpa kartu kredit.
          </Text>

          <View style={{ width: '100%', backgroundColor: C.cream, borderRadius: 14, padding: 14, gap: 8, marginTop: 4 }}>
            {['✉️  Auto-import Gmail', '👥  Workspace keluarga (5 anggota)', '🤖  AI kategorisasi merchant', '🏦  Custom bank parser'].map((perk) => (
              <View key={perk} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: C.fg2, fontFamily: 'Nunito_600SemiBold' }}>{perk}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={onUpgrade}
            style={{
              backgroundColor: C.primary,
              borderRadius: 14,
              paddingVertical: 14,
              paddingHorizontal: 32,
              marginTop: 8,
              width: '100%',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, fontFamily: 'Nunito_800ExtraBold' }}>
              Lihat Paket Pro →
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}
