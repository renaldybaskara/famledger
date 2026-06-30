import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import * as Font from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { useState } from 'react'
import { View } from 'react-native'
import { initSentry, Sentry } from '../src/lib/sentry'
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

  useEffect(() => {
    Font.loadAsync({
      Nunito_400Regular:   require('../assets/fonts/Nunito-Regular.ttf'),
      Nunito_500Medium:    require('../assets/fonts/Nunito-Medium.ttf'),
      Nunito_600SemiBold:  require('../assets/fonts/Nunito-SemiBold.ttf'),
      Nunito_700Bold:      require('../assets/fonts/Nunito-Bold.ttf'),
      Nunito_800ExtraBold: require('../assets/fonts/Nunito-ExtraBold.ttf'),
      Nunito_900Black:     require('../assets/fonts/Nunito-Black.ttf'),
    }).then(() => {
      setFontsLoaded(true)
      SplashScreen.hideAsync()
    }).catch(() => {
      // Fonts failed — continue with system font
      setFontsLoaded(true)
      SplashScreen.hideAsync()
    })
  }, [])

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#FAF7F2' }} />

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" backgroundColor="#FAF7F2" />
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
