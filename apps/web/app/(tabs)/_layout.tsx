import { useEffect, useState } from 'react'
import { Tabs, Redirect } from 'expo-router'
import { View, Text, Platform, ActivityIndicator } from 'react-native'
import { useAuthStore } from '../../src/store/auth.store'
import { configurePurchases } from '../../src/lib/purchases'
import { useSubscription } from '../../src/hooks/useSubscription'
import { TrialOnboardingPopup } from '../../components/TrialOnboardingPopup'
import { useTheme } from '../../src/lib/theme'
import { useThemeStore } from '../../src/store/theme.store'

const ACTIVE   = '#3D7A56'
const INACTIVE = '#9DB5A8'
const ACTIVE_BG = '#E8F5EE'
const ACTIVE_DARK   = '#7AA87A'
const INACTIVE_DARK = '#5A7A5A'
const ACTIVE_BG_DARK = '#1A2E1A'

function SvgTab({ focused, emoji, children }: {
  focused: boolean; emoji: string; children: React.ReactNode
}) {
  const isDark = useThemeStore((s) => s.isDark)
  const activeBg = isDark ? ACTIVE_BG_DARK : ACTIVE_BG
  return (
    <View style={{
      alignItems: 'center', justifyContent: 'center',
      width: 40, height: 32,
      backgroundColor: focused ? activeBg : 'transparent',
      borderRadius: 12,
    }}>
      {Platform.OS === 'web' ? (
        <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          {children}
        </svg>
      ) : (
        <Text style={{ fontSize: 18, lineHeight: 22 }}>{emoji}</Text>
      )}
    </View>
  )
}

export default function TabsLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const { data: sub, isLoading: subLoading } = useSubscription()
  const [showTrialPopup, setShowTrialPopup] = useState(false)
  const C = useTheme()
  // Wait for Zustand AsyncStorage hydration before acting on auth state.
  // Without this, static-rendered HTML always has isAuthenticated=false and
  // immediately redirects to /login before the persisted token is loaded.
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // useAuthStore.persist.hasHydrated() is true synchronously if already done
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true)
    } else {
      const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true))
      return unsub
    }
  }, [])

  useEffect(() => {
    if (user?.id) {
      configurePurchases(user.id).catch(() => {})
    }
  }, [user?.id])

  // Show trial popup when backend says user has never interacted with trial (trialEligible=true)
  // This is DB-driven: trialEligible is only true when no user_subscriptions row exists yet.
  useEffect(() => {
    if (subLoading || !isAuthenticated || !sub) return
    if (sub.trialEligible) {
      setShowTrialPopup(true)
    }
  }, [subLoading, sub, isAuthenticated])

  const activeColor   = C.isDark ? ACTIVE_DARK   : ACTIVE
  const inactiveColor = C.isDark ? INACTIVE_DARK : INACTIVE

  // Don't render until hydration is complete — prevents premature redirect to /login
  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.heroEnd }}>
        <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" />
      </View>
    )
  }

  if (!isAuthenticated) return <Redirect href="/(auth)/login" />

  return (
    <>
      <TrialOnboardingPopup
        visible={showTrialPopup}
        onDismiss={() => setShowTrialPopup(false)}
      />
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor: C.surface,
          borderTopWidth: 1.5,
          borderTopColor: C.border,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 10,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: 'Inter_700Bold',
          fontWeight: '700',
          marginTop: 2,
        },
        tabBarItemStyle: { paddingVertical: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ focused }) => (
            <SvgTab focused={focused} emoji="🏠">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill={focused ? activeColor : inactiveColor} />
            </SvgTab>
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transaksi',
          tabBarIcon: ({ focused }) => (
            <SvgTab focused={focused} emoji="💳">
              <rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke={focused ? activeColor : inactiveColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="2" y1="10" x2="22" y2="10" stroke={focused ? activeColor : inactiveColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </SvgTab>
          ),
        }}
      />
      <Tabs.Screen
        name="budget"
        options={{
          title: 'Budget',
          tabBarIcon: ({ focused }) => (
            <SvgTab focused={focused} emoji="💰">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" fill="none" stroke={focused ? activeColor : inactiveColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </SvgTab>
          ),
        }}
      />
      <Tabs.Screen
        name="email-integration"
        options={{
          title: 'Email',
          tabBarIcon: ({ focused }) => (
            <SvgTab focused={focused} emoji="📧">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" fill="none" stroke={focused ? activeColor : inactiveColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="22,6 12,13 2,6" fill="none" stroke={focused ? activeColor : inactiveColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </SvgTab>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Setelan',
          tabBarIcon: ({ focused }) => (
            <SvgTab focused={focused} emoji="⚙️">
              <circle cx="12" cy="12" r="3" fill="none" stroke={focused ? activeColor : inactiveColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke={focused ? activeColor : inactiveColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </SvgTab>
          ),
        }}
      />
      {/* Hidden screens - accessible via navigation but not in tab bar */}
      <Tabs.Screen name="workspace"  options={{ href: null }} />
      <Tabs.Screen name="accounts"   options={{ href: null }} />
      <Tabs.Screen name="categories" options={{ href: null }} />
    </Tabs>
    </>
  )
}
