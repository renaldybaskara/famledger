import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useIsProActive } from '../hooks/useSubscription'

const C = {
  primary:     '#6B8E6B',
  heroEnd:     '#41594F',
  accent:      '#C97B5C',
  accentSoft:  '#F4DDD0',
  fg1:         '#2D2A26',
  fg2:         '#55504A',
  fg3:         '#8E887F',
  surface:     '#FFFFFF',
  cream:       '#FAF7F2',
  mustardSoft: '#FBEFD2',
}

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

  if (isPro) return <>{children}</>

  return (
    <View style={{ position: 'relative' }}>
      {/* Blurred/faded content preview */}
      <View style={{ opacity: 0.15, pointerEvents: 'none' } as any}>
        {children}
      </View>

      {/* Overlay */}
      <View style={[StyleSheet.absoluteFill, styles.overlay]}>
        <View style={styles.card}>
          <View style={styles.lockBadge}>
            <Text style={{ fontSize: 28 }}>🔒</Text>
          </View>

          <Text style={styles.title}>Fitur Pro</Text>
          <Text style={styles.featureName}>{featureName}</Text>
          <Text style={styles.desc}>
            Fitur ini tersedia di paket Pro FamLedger.{'\n'}
            Mulai dengan 14 hari trial gratis — tanpa kartu kredit.
          </Text>

          <View style={styles.perks}>
            {['✉️  Auto-import Gmail', '👥  Workspace keluarga (5 anggota)', '🤖  AI kategorisasi merchant', '🏦  Custom bank parser'].map((perk) => (
              <View key={perk} style={styles.perkRow}>
                <Text style={styles.perkText}>{perk}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity onPress={onUpgrade} style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnText}>Lihat Paket Pro →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(250,247,242,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#2D2A26',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    gap: 8,
  },
  lockBadge: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: C.mustardSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 11,
    fontWeight: '800',
    color: C.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Nunito_800ExtraBold',
  },
  featureName: {
    fontSize: 20,
    fontWeight: '900',
    color: C.fg1,
    fontFamily: 'Nunito_900Black',
    textAlign: 'center',
  },
  desc: {
    fontSize: 13,
    color: C.fg3,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Nunito_500Medium',
    marginTop: 2,
  },
  perks: {
    width: '100%',
    backgroundColor: C.cream,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginTop: 4,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  perkText: {
    fontSize: 13,
    color: C.fg2,
    fontFamily: 'Nunito_600SemiBold',
  },
  upgradeBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  upgradeBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    fontFamily: 'Nunito_800ExtraBold',
  },
})
