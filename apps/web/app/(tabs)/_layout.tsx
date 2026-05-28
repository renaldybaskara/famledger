import { Tabs, Redirect } from 'expo-router'
import { View, Platform } from 'react-native'
import { Home, List, PieChart, Mail, Settings } from 'lucide-react'
// accounts and categories are accessible via Settings, not as tabs
import { useAuthStore } from '../../src/store/auth.store'

function TabBarIcon({ Icon, color, focused }: { Icon: any; color: string; focused: boolean }) {
  return (
    <View
      className={`items-center justify-center ${
        focused ? 'bg-primary/10 rounded-xl' : ''
      }`}
      style={{ width: 40, height: 36 }}
    >
      <Icon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
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
        tabBarActiveTintColor: '#1A2B4A',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
          height: Platform.OS === 'ios' ? 85 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
          elevation: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon Icon={Home} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transaksi',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon Icon={List} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="budget"
        options={{
          title: 'Anggaran',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon Icon={PieChart} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="email-integration"
        options={{
          title: 'Email',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon Icon={Mail} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Pengaturan',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon Icon={Settings} color={color} focused={focused} />
          ),
        }}
      />
      {/* Hidden screens — accessible via router.push but not in tab bar */}
      <Tabs.Screen name="accounts"   options={{ href: null }} />
      <Tabs.Screen name="categories" options={{ href: null }} />
    </Tabs>
  )
}
