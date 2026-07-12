import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import * as Font from 'expo-font'
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black } from '@expo-google-fonts/inter'
import * as SplashScreen from 'expo-splash-screen'
import { useState } from 'react'
import { View } from 'react-native'
import { initSentry, Sentry } from '../src/lib/sentry'
import { useThemeStore } from '../src/store/theme.store'
import '../global.css'

initSentry()
SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries:   { retry: 1, staleTime: 30_000 },
    mutations: { retry: 0 },
  },
})

function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false)
  const isDark = useThemeStore((s) => s.isDark)

  useEffect(() => {
    Font.loadAsync({
      Inter_400Regular:   Inter_400Regular,
      Inter_500Medium:    Inter_500Medium,
      Inter_600SemiBold:  Inter_600SemiBold,
      Inter_700Bold:      Inter_700Bold,
      Inter_800ExtraBold: Inter_800ExtraBold,
      Inter_900Black:     Inter_900Black,
    }).then(() => {
      setFontsLoaded(true)
      SplashScreen.hideAsync()
    }).catch(() => {
      // Fonts failed — continue with system font
      setFontsLoaded(true)
      SplashScreen.hideAsync()
    })
  }, [])

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: isDark ? '#161412' : '#FAF7F2' }} />

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={isDark ? '#161412' : '#FAF7F2'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="workspace" />
      </Stack>
    </QueryClientProvider>
  )
}

export default Sentry.wrap(RootLayout)
