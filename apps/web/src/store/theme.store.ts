import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface ThemeState {
  isDark: boolean
  toggle: () => void
  setDark: (dark: boolean) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: false,
      toggle: () => set((s) => ({ isDark: !s.isDark })),
      setDark: (dark) => set({ isDark: dark }),
    }),
    {
      name: 'saku-theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ isDark: state.isDark }),
    }
  )
)
