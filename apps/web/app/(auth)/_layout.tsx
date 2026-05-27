import { Stack } from 'expo-router'
import { Redirect } from 'expo-router'
import { useAuthStore } from '../../src/store/auth.store'

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (isAuthenticated) return <Redirect href="/(tabs)" />
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    />
  )
}
