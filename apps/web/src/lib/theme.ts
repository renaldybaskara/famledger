import { useThemeStore } from '../store/theme.store'

export interface ThemeColors {
  // Backgrounds
  cream: string
  creamSunken: string
  surface: string
  // Foregrounds
  fg1: string
  fg1d: string    // darker fg1 variant for emphasis text
  fg2: string
  fg3: string
  fg4: string
  // Borders
  border: string
  divider: string
  // Primary (sage green)
  primary: string
  primarySoft: string
  primaryDeep: string  // deeper green for chart bars
  heroStart: string
  heroEnd: string
  // Accent (clay/terracotta)
  accent: string
  accentSoft: string
  // Semantic
  income: string
  expense: string
  expenseDeep: string  // deeper expense color for chart bars
  danger: string
  dangerSoft: string
  mustard: string
  mustardSoft: string
  infoSoft: string
  // Filter pills & chart containers
  filterActive: string
  filterInactive: string
  chartBg: string
  // Raw dark flag (for conditional logic)
  isDark: boolean
}

export const lightColors: ThemeColors = {
  cream:        '#FAF7F2',
  creamSunken:  '#F4EEE3',
  surface:      '#FFFFFF',
  fg1:          '#2D2A26',
  fg1d:         '#1A1816',
  fg2:          '#55504A',
  fg3:          '#8E887F',
  fg4:          '#A8A39B',
  border:       '#E0DBD2',
  divider:      '#ECE4D3',
  primary:      '#6B8E6B',
  primarySoft:  '#DEE8D7',
  primaryDeep:  '#3D7A56',
  heroStart:    '#6B8E6B',
  heroEnd:      '#41594F',
  accent:       '#C97B5C',
  accentSoft:   '#F4DDD0',
  income:       '#3D7A56',
  expense:      '#D4704A',
  expenseDeep:  '#C25A30',
  danger:       '#C66B6B',
  dangerSoft:   'rgba(198,107,107,0.1)',
  mustard:      '#D9A441',
  mustardSoft:  '#FBEFD2',
  infoSoft:     '#DEEAF1',
  filterActive:   '#3D7A56',
  filterInactive: '#F4EEE3',
  chartBg:        '#F7FAFA',
  isDark:       false,
}

export const darkColors: ThemeColors = {
  cream:        '#161412',
  creamSunken:  '#1E1B18',
  surface:      '#252220',
  fg1:          '#F0EDE8',
  fg1d:         '#FFFFFF',
  fg2:          '#C5BFB8',
  fg3:          '#8A857D',
  fg4:          '#5A554F',
  border:       '#3A3530',
  divider:      '#302C28',
  primary:      '#7AA87A',
  primarySoft:  '#1A2E1A',
  primaryDeep:  '#5EA87A',
  heroStart:    '#4A6E4A',
  heroEnd:      '#2E4438',
  accent:       '#D4896A',
  accentSoft:   '#3A2218',
  income:       '#5EA87A',
  expense:      '#D4896A',
  expenseDeep:  '#E89070',
  danger:       '#D97070',
  dangerSoft:   'rgba(217,112,112,0.15)',
  mustard:      '#D9A441',
  mustardSoft:  '#2E2410',
  infoSoft:     '#1A2A38',
  filterActive:   '#5EA87A',
  filterInactive: '#252220',
  chartBg:        '#1E1B18',
  isDark:       true,
}

/**
 * useTheme — returns the current color set based on dark mode state.
 * Use this instead of the local `const C = { ... }` pattern in each screen.
 *
 * @example
 * const C = useTheme()
 * <View style={{ backgroundColor: C.cream }}>
 */
export function useTheme(): ThemeColors {
  const isDark = useThemeStore((s) => s.isDark)
  return isDark ? darkColors : lightColors
}
