import { Redirect } from 'expo-router'

// Register tidak diperlukan — user masuk via Google OAuth (auto-register)
export default function RegisterScreen() {
  return <Redirect href="/(auth)/login" />
}
