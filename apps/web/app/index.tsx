import { Redirect } from 'expo-router'
import { useAuthStore } from '../src/store/auth.store'

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return <Redirect href={isAuthenticated ? '/(tabs)' : '/(auth)/login'} />
}
