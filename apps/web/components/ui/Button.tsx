import React from 'react'
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
  View,
} from 'react-native'

interface ButtonProps extends TouchableOpacityProps {
  title: string
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
}

const variantStyles = {
  primary: {
    container: 'bg-primary',
    text: 'text-white',
    disabledContainer: 'bg-primary/60',
  },
  secondary: {
    container: 'bg-primary-50',
    text: 'text-primary',
    disabledContainer: 'bg-primary-50/60',
  },
  outline: {
    container: 'bg-transparent border border-primary',
    text: 'text-primary',
    disabledContainer: 'bg-transparent border border-primary/40',
  },
  ghost: {
    container: 'bg-transparent',
    text: 'text-primary',
    disabledContainer: 'bg-transparent',
  },
  danger: {
    container: 'bg-expense',
    text: 'text-white',
    disabledContainer: 'bg-expense/60',
  },
}

const sizeStyles = {
  sm: { container: 'px-3 py-2 rounded-lg', text: 'text-sm font-medium', indicator: 'small' as const },
  md: { container: 'px-4 py-3 rounded-xl', text: 'text-base font-semibold', indicator: 'small' as const },
  lg: { container: 'px-6 py-4 rounded-xl', text: 'text-base font-semibold', indicator: 'small' as const },
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
  className = '',
  ...props
}: ButtonProps) {
  const vs = variantStyles[variant]
  const ss = sizeStyles[size]
  const isDisabled = disabled || loading
  const containerClass = `${isDisabled ? vs.disabledContainer : vs.container} ${ss.container} ${
    fullWidth ? 'w-full' : ''
  } flex-row items-center justify-center ${className}`

  return (
    <TouchableOpacity
      className={containerClass}
      disabled={isDisabled}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size={ss.indicator}
          color={variant === 'primary' || variant === 'danger' ? 'white' : '#2D2A26'}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <View className="mr-2">{icon}</View>
          )}
          <Text className={`${vs.text} ${ss.text}`}>{title}</Text>
          {icon && iconPosition === 'right' && (
            <View className="ml-2">{icon}</View>
          )}
        </>
      )}
    </TouchableOpacity>
  )
}
