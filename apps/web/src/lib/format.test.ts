import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatDateShort,
  formatMonth,
  getCurrentMonthRange,
  formatPercent,
} from './format'

// ─── formatCurrency ───────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  test('formats 1500000 as Rp with dots', () => {
    const result = formatCurrency(1_500_000)
    expect(result).toContain('1.500.000')
    expect(result).toMatch(/Rp|IDR/)
  })

  test('formats 0', () => {
    expect(formatCurrency(0)).toContain('0')
  })

  test('formats 50000', () => {
    const result = formatCurrency(50_000)
    expect(result).toContain('50.000')
  })

  test('no decimal digits for whole amounts', () => {
    const result = formatCurrency(100_000)
    expect(result).not.toMatch(/[.,]\d{2}$/)
  })
})

// ─── formatCurrencyCompact ────────────────────────────────────────────────────

describe('formatCurrencyCompact', () => {
  test('billions → M suffix', () => {
    expect(formatCurrencyCompact(2_000_000_000)).toBe('Rp 2.0 M')
  })

  test('billions with fraction', () => {
    expect(formatCurrencyCompact(1_500_000_000)).toBe('Rp 1.5 M')
  })

  test('millions → jt suffix', () => {
    expect(formatCurrencyCompact(1_500_000)).toBe('Rp 1.5 jt')
  })

  test('exact million', () => {
    expect(formatCurrencyCompact(1_000_000)).toBe('Rp 1.0 jt')
  })

  test('thousands → rb suffix', () => {
    expect(formatCurrencyCompact(500_000)).toBe('Rp 500 rb')
  })

  test('under 1000 falls back to full format', () => {
    const result = formatCurrencyCompact(999)
    expect(result).toContain('999')
  })

  test('negative million', () => {
    expect(formatCurrencyCompact(-1_000_000)).toBe('Rp -1.0 jt')
  })
})

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  test('returns "Hari ini" for today', () => {
    expect(formatDate(new Date())).toBe('Hari ini')
  })

  test('returns "Kemarin" for yesterday', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(formatDate(yesterday)).toBe('Kemarin')
  })

  test('formats past date with Indonesian month name', () => {
    const result = formatDate('2024-01-15')
    expect(result).toContain('2024')
    expect(result.toLowerCase()).toMatch(/januari|jan/)
  })

  test('accepts string input', () => {
    expect(() => formatDate('2024-06-01')).not.toThrow()
  })

  test('accepts Date input', () => {
    expect(() => formatDate(new Date('2024-06-01'))).not.toThrow()
  })
})

// ─── formatDateShort ──────────────────────────────────────────────────────────

describe('formatDateShort', () => {
  test('returns "Hari ini" for today', () => {
    expect(formatDateShort(new Date())).toBe('Hari ini')
  })

  test('returns "Kemarin" for yesterday', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(formatDateShort(yesterday)).toBe('Kemarin')
  })

  test('short format contains day number', () => {
    const result = formatDateShort('2024-03-20')
    expect(result).toMatch(/\d+/)
  })
})

// ─── formatMonth ─────────────────────────────────────────────────────────────

describe('formatMonth', () => {
  test('January → Jan (Indonesian)', () => {
    expect(formatMonth('2024-01')).toMatch(/Jan/i)
  })

  test('July → Jul (Indonesian)', () => {
    expect(formatMonth('2024-07')).toMatch(/Jul/i)
  })

  test('December → Des or Dec', () => {
    const result = formatMonth('2024-12')
    expect(result).toMatch(/Des|Dec/i)
  })
})

// ─── getCurrentMonthRange ─────────────────────────────────────────────────────

describe('getCurrentMonthRange', () => {
  test('startDate is first day of month', () => {
    const { startDate } = getCurrentMonthRange()
    expect(startDate).toMatch(/^\d{4}-\d{2}-01$/)
  })

  test('startDate and endDate are in same month', () => {
    const { startDate, endDate } = getCurrentMonthRange()
    expect(startDate.slice(0, 7)).toBe(endDate.slice(0, 7))
  })

  test('endDate is last day of month', () => {
    const { startDate, endDate } = getCurrentMonthRange()
    const [y, m] = startDate.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    expect(endDate).toBe(`${startDate.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`)
  })

  test('dates are YYYY-MM-DD format', () => {
    const { startDate, endDate } = getCurrentMonthRange()
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ─── formatPercent ────────────────────────────────────────────────────────────

describe('formatPercent', () => {
  test('whole number', () => {
    expect(formatPercent(75)).toBe('75%')
  })

  test('rounds decimal down', () => {
    expect(formatPercent(75.3)).toBe('75%')
  })

  test('rounds decimal up', () => {
    expect(formatPercent(75.7)).toBe('76%')
  })

  test('zero', () => {
    expect(formatPercent(0)).toBe('0%')
  })

  test('100', () => {
    expect(formatPercent(100)).toBe('100%')
  })

  test('over 100 (over-budget scenario)', () => {
    expect(formatPercent(120)).toBe('120%')
  })
})
