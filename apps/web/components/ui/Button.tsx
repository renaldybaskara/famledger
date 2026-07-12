import React from 'react'
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
  View,
  StyleSheet,
} from 'react-native'
import { useTheme } from '../../src/lib/theme'

interface ButtonProps extends TouchableOpacityProps {
  title: string
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
}

const sizeStyles = {
  sm: { paddingHorizontal: 12, paddingVertical: 8,  borderRadius: 8,  fontSize: 14 },
  md: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, fontSize: 16 },
  lg: { paddingHorizontal: 24, paddingVertical: 16, borderRadius: 12, fontSize: 16 },
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const C = useTheme()
  const ss = sizeStyles[size]
  const isDisabled = disabled || loading

  const variantConfig = {
    primary:   { bg: C.primary,      text: '#FFFFFF', disabledBg: C.primary + '99' },
    secondary: { bg: C.primarySoft,  text: C.primary, disabledBg: C.primarySoft + '99' },
    outline:   { bg: 'transparent',  text: C.primary, disabledBg: 'transparent', borderWidth: 1, borderColor: isDisabled ? C.primary + '66' : C.primary },
    ghost:     { bg: 'transparent',  text: C.primary, disabledBg: 'transparent' },
    danger:    { bg: C.expense,      text: '#FFFFFF', disabledBg: C.expense + '99' },
  }

  const vc = variantConfig[variant]

  return (
    <TouchableOpacity
      style={[
        {
          backgroundColor: isDisabled ? vc.disabledBg : vc.bg,
          paddingHorizontal: ss.paddingHorizontal,
          paddingVertical: ss.paddingVertical,
          borderRadius: ss.borderRadius,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          ...(fullWidth ? { width: '100%' } : {}),
          ...('borderWidth' in vc ? { borderWidth: vc.borderWidth, borderColor: vc.borderColor } : {}),
        },
        style,
      ]}
      disabled={isDisabled}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : C.primary}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && <View style={{ marginRight: 8 }}>{icon}</View>}
          <Text style={{ color: vc.text, fontSize: ss.fontSize, fontWeight: '600', fontFamily: 'Inter_600SemiBold' }}>
            {title}
          </Text>
          {icon && iconPosition === 'right' && <View style={{ marginLeft: 8 }}>{icon}</View>}
        </>
      )}
    </TouchableOpacity>
  )
}
