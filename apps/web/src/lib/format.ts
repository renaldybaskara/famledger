import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { id } from 'date-fns/locale'

/**
 * Format amount as Indonesian Rupiah
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format compact amount (e.g. 1.5 jt)
 */
export function formatCurrencyCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toFixed(1)} M`
  }
  if (Math.abs(amount) >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toFixed(1)} jt`
  }
  if (Math.abs(amount) >= 1_000) {
    return `Rp ${(amount / 1_000).toFixed(0)} rb`
  }
  return formatCurrency(amount)
}

/**
 * Format date to Indonesian readable string
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isToday(d)) return 'Hari ini'
  if (isYesterday(d)) return 'Kemarin'
  return format(d, 'd MMMM yyyy', { locale: id })
}

/**
 * Format date for transaction list (short)
 */
export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isToday(d)) return 'Hari ini'
  if (isYesterday(d)) return 'Kemarin'
  return format(d, 'd MMM', { locale: id })
}

/**
 * Format month label for charts (Jan, Feb, ...)
 */
export function formatMonth(monthStr: string): string {
  // monthStr expected: "2024-01"
  const [year, month] = monthStr.split('-')
  const d = new Date(parseInt(year), parseInt(month) - 1, 1)
  return format(d, 'MMM', { locale: id })
}

/**
 * Get current month date range
 */
export function getCurrentMonthRange(): { startDate: string; endDate: string } {
  const now = new Date()
  const startDate = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd')
  const endDate = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd')
  return { startDate, endDate }
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}
