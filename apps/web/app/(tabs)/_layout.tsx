import { useEffect, useState } from 'react'
import { Tabs, Redirect } from 'expo-router'
import { View, Text, Platform } from 'react-native'
import { useAuthStore } from '../../src/store/auth.store'
import { configurePurchases } from '../../src/lib/purchases'
import { useSubscription } from '../../src/hooks/useSubscription'
import { TrialOnboardingPopup } from '../../components/TrialOnboardingPopup'

const ACTIVE   = '#3D7A56'
const INACTIVE = '#9DB5A8'
const ACTIVE_BG = '#E8F5EE'

function SvgTab({ focused, emoji, children }: {
  focused: boolean; emoji: string; children: React.ReactNode
}) {
  return (
    <View style={{
      alignItems: 'center', justifyContent: 'center',
      width: 40, height: 32,
      backgroundColor: focused ? ACTIVE_BG : 'transparent',
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
        tabBarActiveTintColor:   ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1.5,
          borderTopColor: '#EEF3F0',
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 10,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: 'Nunito_700Bold',
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
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill={focused ? ACTIVE : INACTIVE} />
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
              <rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke={focused ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="2" y1="10" x2="22" y2="10" stroke={focused ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" fill="none" stroke={focused ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" fill="none" stroke={focused ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="22,6 12,13 2,6" fill="none" stroke={focused ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
              <circle cx="12" cy="12" r="3" fill="none" stroke={focused ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke={focused ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
