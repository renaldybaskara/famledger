import React from 'react'
import { View, ViewProps } from 'react-native'
import { useTheme } from '../../src/lib/theme'

interface CardProps extends ViewProps {
  children: React.ReactNode
  variant?: 'default' | 'elevated' | 'outlined' | 'sunken'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  style,
  ...props
}: CardProps) {
  const C = useTheme()

  const paddingValue =
    padding === 'none' ? 0
    : padding === 'sm' ? 12
    : padding === 'lg' ? 24
    : 16

  const variantStyle =
    variant === 'elevated'
      ? {
          backgroundColor: C.surface,
          shadowColor: C.fg1,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.07,
          shadowRadius: 16,
          elevation: 6,
        }
      : variant === 'outlined'
      ? {
          backgroundColor: C.surface,
          borderWidth: 1,
          borderColor: C.border,
        }
      : variant === 'sunken'
      ? {
          backgroundColor: C.creamSunken,
        }
      : {
          // default
          backgroundColor: C.surface,
          shadowColor: C.fg1,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
        }

  return (
    <View
      style={[
        { borderRadius: 18, padding: paddingValue },
        variantStyle,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  )
}
