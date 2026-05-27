import {
  pgTable, uuid, varchar, text, boolean, timestamp, pgEnum, numeric, integer
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { categories } from './categories'

export const budgetPeriodEnum = pgEnum('budget_period', ['monthly', 'weekly', 'yearly', 'custom'])

export const budgets = pgTable('budgets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
  period: budgetPeriodEnum('period').default('monthly').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  isActive: boolean('is_active').default(true).notNull(),
  carryOver: boolean('carry_over').default(false),   // Premium+
  alertAt80: boolean('alert_at_80').default(true),
  alertAt100: boolean('alert_at_100').default(true),
  alertAt120: boolean('alert_at_120').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id),
  name: varchar('name', { length: 255 }).notNull(),
  merchant: varchar('merchant', { length: 255 }),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
  billingCycle: varchar('billing_cycle', { length: 20 }).default('monthly').notNull(), // monthly, yearly, weekly
  nextBillingDate: timestamp('next_billing_date'),
  isActive: boolean('is_active').default(true).notNull(),
  isAutoDetected: boolean('is_auto_detected').default(false),
  reminderDaysBefore: integer('reminder_days_before').default(3),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(users, { fields: [budgets.userId], references: [users.id] }),
  category: one(categories, { fields: [budgets.categoryId], references: [categories.id] }),
}))

export type Budget = typeof budgets.$inferSelect
export type NewBudget = typeof budgets.$inferInsert
export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
