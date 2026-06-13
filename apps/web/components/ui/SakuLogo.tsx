import React from 'react'
import { View, Text, Platform } from 'react-native'
import Svg, { Path, G, Rect } from 'react-native-svg'

// ── Pouch mark only (96×96 viewBox) ──────────────────────────────────────────
export function SakuMark({ size = 48 }: { size?: number }) {
  return (
    <Svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
    >
      <Path d="M30 36 L66 36 C70 44 78 52 78 64 C78 76 64 82 48 82 C32 82 18 76 18 64 C18 52 26 44 30 36 Z" fill="#6B8E6B" />
      <Path d="M30 36 C30 30 38 26 48 26 C58 26 66 30 66 36 C60 40 54 41 48 41 C42 41 36 40 30 36 Z" fill="#547254" />
      <Path d="M48 54 C 41 54 37 48 38 41 C 46 42 50 48 48 54 Z" fill="#DEE8D7" />
      <Path d="M48 54 C 55 54 59 48 58 41 C 50 42 46 48 48 54 Z" fill="#F1F5EE" />
    </Svg>
  )
}

// ── Pouch mark on rounded square (favicon style) ─────────────────────────────
export function SakuIcon({ size = 48, rounded = true }: { size?: number; rounded?: boolean }) {
  return (
    <Svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
    >
      {rounded && <Rect width="96" height="96" rx="24" fill="#6B8E6B" />}
      <G transform="translate(13 11) scale(0.72)">
        <Path d="M30 36 L66 36 C70 44 78 52 78 64 C78 76 64 82 48 82 C32 82 18 76 18 64 C18 52 26 44 30 36 Z" fill="#FDFBF7" />
        <Path d="M30 36 C30 30 38 26 48 26 C58 26 66 30 66 36 C60 40 54 41 48 41 C42 41 36 40 30 36 Z" fill="#DEE8D7" />
        <Path d="M48 54 C 41 54 37 48 38 41 C 46 42 50 48 48 54 Z" fill="#6B8E6B" />
        <Path d="M48 54 C 55 54 59 48 58 41 C 50 42 46 48 48 54 Z" fill="#547254" />
      </G>
    </Svg>
  )
}

// ── Wordmark: icon + "Saku" text (React Native Text, cross-platform) ──────────
export function SakuWordmark({ height = 48 }: { height?: number }) {
  const iconSize = Math.round(height * 0.85)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <SakuMark size={iconSize} />
      <Text
        style={{
          fontFamily: 'Nunito_900Black',
          fontSize: Math.round(height * 0.52),
          color: '#2D2A26',
          letterSpacing: -1,
          lineHeight: height,
        }}
      >
        Saku
        <Text style={{ color: '#C97B5C' }}>.</Text>
      </Text>
    </View>
  )
}
