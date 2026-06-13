import React from 'react'
import { View, ViewProps, StyleSheet } from 'react-native'

interface CardProps extends ViewProps {
  children: React.ReactNode
  variant?: 'default' | 'elevated' | 'outlined' | 'sunken'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  elevated: {
    shadowColor: '#2D2A26',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 6,
  },
  default: {
    shadowColor: '#2D2A26',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  outlined: {
    borderWidth: 1,
    borderColor: '#E0DBD2',
  },
  sunken: {
    backgroundColor: '#F4EEE3',
  },
  p0: { padding: 0 },
  p3: { padding: 12 },
  p4: { padding: 16 },
  p6: { padding: 24 },
})

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  style,
  ...props
}: CardProps) {
  const variantStyle =
    variant === 'elevated' ? styles.elevated
    : variant === 'outlined' ? styles.outlined
    : variant === 'sunken'   ? styles.sunken
    : styles.default

  const paddingStyle =
    padding === 'none' ? styles.p0
    : padding === 'sm'   ? styles.p3
    : padding === 'lg'   ? styles.p6
    : styles.p4

  return (
    <View style={[styles.base, variantStyle, paddingStyle, style]} {...props}>
      {children}
    </View>
  )
}
