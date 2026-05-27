import React from 'react'
import { View, ViewProps } from 'react-native'

interface CardProps extends ViewProps {
  children: React.ReactNode
  variant?: 'default' | 'elevated' | 'outlined'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddingMap = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

const variantMap = {
  default: 'bg-white rounded-2xl shadow-sm',
  elevated: 'bg-white rounded-2xl shadow-md',
  outlined: 'bg-white rounded-2xl border border-slate-200',
}

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  style,
  ...props
}: CardProps) {
  return (
    <View
      className={`${variantMap[variant]} ${paddingMap[padding]} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </View>
  )
}
