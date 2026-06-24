import React from 'react'
import { View, Text, Image } from 'react-native'

const LOGO = require('../../assets/images/icon.png')

// ── App icon (PNG logo) ───────────────────────────────────────────────────────
export function FamLedgerIcon({ size = 48, rounded = true }: { size?: number; rounded?: boolean }) {
  return (
    <Image
      source={LOGO}
      style={{
        width: size,
        height: size,
        borderRadius: rounded ? Math.round(size * 0.22) : 0,
      }}
      resizeMode="cover"
    />
  )
}

// ── Mark only (small square logo, e.g. in wordmark) ──────────────────────────
export function FamLedgerMark({ size = 48 }: { size?: number }) {
  return (
    <Image
      source={LOGO}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.22),
      }}
      resizeMode="cover"
    />
  )
}

// ── Wordmark: icon + "FamLedger" text ────────────────────────────────────────
export function FamLedgerWordmark({ height = 48 }: { height?: number }) {
  const iconSize = Math.round(height * 0.85)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <FamLedgerMark size={iconSize} />
      <Text
        style={{
          fontFamily: 'Nunito_900Black',
          fontSize: Math.round(height * 0.52),
          color: '#FFFFFF',
          letterSpacing: -1,
          lineHeight: height,
        }}
      >
        FamLedger
        <Text style={{ color: '#C97B5C' }}>.</Text>
      </Text>
    </View>
  )
}
