// Maps legacy lucide-react icon name strings (stored in DB) to emoji equivalents.
// Used as a fallback so old records display correctly without a DB migration.
const LUCIDE_TO_EMOJI: Record<string, string> = {
  // Income
  briefcase:         '💼',
  laptop:            '💻',
  'trending-up':     '📈',
  gift:              '🎁',
  'plus-circle':     '➕',
  // Expense
  utensils:          '🍽️',
  car:               '🚗',
  'shopping-bag':    '🛒',
  zap:               '⚡',
  heart:             '❤️',
  film:              '🎬',
  book:              '📚',
  home:              '🏠',
  shirt:             '👕',
  activity:          '🏋️',
  smile:             '😊',
  'more-horizontal': '•••',
  // Transfer
  'refresh-cw':      '🔄',
  'piggy-bank':      '🐷',
  'bar-chart-2':     '📊',
  'arrow-right-left':'↔️',
  // Other common names
  wallet:            '👛',
  'credit-card':     '💳',
  smartphone:        '📱',
  building:          '🏦',
  'building-2':      '🏦',
  plane:             '✈️',
  coffee:            '☕',
  music:             '🎵',
  gamepad:           '🎮',
  'game-pad':        '🎮',
  baby:              '👶',
  pet:               '🐾',
  fuel:              '⛽',
  bus:               '🚌',
  pill:              '💊',
  hospital:          '🏥',
}

export function resolveIcon(icon: string, fallback = '💰'): string {
  if (!icon) return fallback
  return LUCIDE_TO_EMOJI[icon] ?? icon
}
