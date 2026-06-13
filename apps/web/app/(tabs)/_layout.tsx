import { Tabs, Redirect } from 'expo-router'
import { View, Text, Platform, TouchableOpacity } from 'react-native'
import { useAuthStore } from '../../src/store/auth.store'

// Saku colors
const C = {
  primary:  '#6B8E6B',
  inactive: '#A8A39B',
  bg:       '#FFFFFF',
  border:   '#ECE4D3',
  fabBg:    '#6B8E6B',
}

// Tab icons using emoji-style text or minimal unicode
// (avoids dependency on icon lib for reliability)
function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <View style={{
      alignItems: 'center', justifyContent: 'center',
      width: 44, height: 32,
      backgroundColor: focused ? 'rgba(107,142,107,0.12)' : 'transparent',
      borderRadius: 12,
    }}>
      <Text style={{ fontSize: 20, lineHeight: 24 }}>{icon}</Text>
    </View>
  )
}

function FABIcon() {
  return (
    <View style={{
      width: 52, height: 52,
      borderRadius: 18,
      backgroundColor: C.fabBg,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: Platform.OS === 'ios' ? 12 : 4,
      shadowColor: '#2D2A26',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
    }}>
      <Text style={{ color: '#fff', fontSize: 28, lineHeight: 32, marginTop: -2 }}>+</Text>
    </View>
  )
}

export default function TabsLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   C.primary,
        tabBarInactiveTintColor: C.inactive,
        tabBarStyle: {
          backgroundColor: C.bg,
          borderTopWidth: 1,
          borderTopColor: C.border,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
          elevation: 0,
          shadowColor: '#2D2A26',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 16,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'Nunito_700Bold',
          fontWeight: '700',
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transaksi',
          tabBarIcon: ({ focused }) => <TabIcon icon="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="budget"
        options={{
          title: 'Anggaran',
          tabBarIcon: ({ focused }) => <TabIcon icon="🎯" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Lainnya',
          tabBarIcon: ({ focused }) => <TabIcon icon="⚙️" focused={focused} />,
        }}
      />
      {/* Hidden screens */}
      <Tabs.Screen name="email-integration" options={{ href: null }} />
      <Tabs.Screen name="workspace"         options={{ href: null }} />
      <Tabs.Screen name="accounts"          options={{ href: null }} />
      <Tabs.Screen name="categories"        options={{ href: null }} />
    </Tabs>
  )
}
