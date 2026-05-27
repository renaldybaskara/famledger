import { createDb, categories, transactionTypeEnum } from './index'

const DEFAULT_CATEGORIES = [
  // Income
  { name: 'Gaji', nameEn: 'Salary', icon: 'briefcase', color: '#10B981', type: 'income' as const, isDefault: true, sortOrder: 1 },
  { name: 'Freelance', nameEn: 'Freelance', icon: 'laptop', color: '#10B981', type: 'income' as const, isDefault: true, sortOrder: 2 },
  { name: 'Investasi', nameEn: 'Investment', icon: 'trending-up', color: '#10B981', type: 'income' as const, isDefault: true, sortOrder: 3 },
  { name: 'Hadiah', nameEn: 'Gift', icon: 'gift', color: '#10B981', type: 'income' as const, isDefault: true, sortOrder: 4 },
  { name: 'Lainnya', nameEn: 'Other Income', icon: 'plus-circle', color: '#10B981', type: 'income' as const, isDefault: true, sortOrder: 99 },

  // Expense
  { name: 'Makanan & Minuman', nameEn: 'Food & Drinks', icon: 'utensils', color: '#EF4444', type: 'expense' as const, isDefault: true, sortOrder: 1 },
  { name: 'Transportasi', nameEn: 'Transportation', icon: 'car', color: '#F59E0B', type: 'expense' as const, isDefault: true, sortOrder: 2 },
  { name: 'Belanja', nameEn: 'Shopping', icon: 'shopping-bag', color: '#8B5CF6', type: 'expense' as const, isDefault: true, sortOrder: 3 },
  { name: 'Tagihan', nameEn: 'Bills', icon: 'file-text', color: '#6366F1', type: 'expense' as const, isDefault: true, sortOrder: 4 },
  { name: 'Kesehatan', nameEn: 'Healthcare', icon: 'heart', color: '#EC4899', type: 'expense' as const, isDefault: true, sortOrder: 5 },
  { name: 'Pendidikan', nameEn: 'Education', icon: 'book-open', color: '#06B6D4', type: 'expense' as const, isDefault: true, sortOrder: 6 },
  { name: 'Hiburan', nameEn: 'Entertainment', icon: 'tv', color: '#F97316', type: 'expense' as const, isDefault: true, sortOrder: 7 },
  { name: 'Perjalanan', nameEn: 'Travel', icon: 'plane', color: '#14B8A6', type: 'expense' as const, isDefault: true, sortOrder: 8 },
  { name: 'Langganan', nameEn: 'Subscriptions', icon: 'repeat', color: '#A855F7', type: 'expense' as const, isDefault: true, sortOrder: 9 },
  { name: 'Investasi Keluar', nameEn: 'Investment Out', icon: 'bar-chart-2', color: '#0EA5E9', type: 'expense' as const, isDefault: true, sortOrder: 10 },
  { name: 'Lainnya', nameEn: 'Other', icon: 'more-horizontal', color: '#6B7280', type: 'expense' as const, isDefault: true, sortOrder: 99 },
]

async function seed() {
  const db = createDb(process.env.DATABASE_URL!)

  console.log('🌱 Seeding default categories...')
  await db.insert(categories).values(DEFAULT_CATEGORIES).onConflictDoNothing()
  console.log('✅ Seed complete!')

  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
