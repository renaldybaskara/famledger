import {
  pgTable, uuid, varchar, boolean, timestamp, pgEnum, text, integer
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'

export const transactionTypeEnum = pgEnum('transaction_type', ['income', 'expense', 'transfer'])

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }), // null = global default
  name: varchar('name', { length: 100 }).notNull(),
  nameEn: varchar('name_en', { length: 100 }),
  icon: varchar('icon', { length: 50 }).notNull(),
  color: varchar('color', { length: 7 }).notNull(),
  type: transactionTypeEnum('type').notNull(),
  parentId: uuid('parent_id'), // for sub-categories
  isDefault: boolean('is_default').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const categoryRules = pgTable('category_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  ruleType: varchar('rule_type', { length: 50 }).notNull(), // keyword, merchant, regex
  pattern: text('pattern').notNull(),
  priority: integer('priority').default(0),
  isGlobal: boolean('is_global').default(false),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  parent: one(categories, { fields: [categories.parentId], references: [categories.id] }),
  rules: many(categoryRules),
}))

export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert
