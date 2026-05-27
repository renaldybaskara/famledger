import {
  pgTable, uuid, varchar, text, boolean, timestamp, pgEnum, numeric, jsonb, integer, index
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { accounts } from './accounts'
import { categories, transactionTypeEnum } from './categories'

export const txSourceEnum = pgEnum('tx_source', ['manual', 'email', 'notification', 'import'])
export const txStatusEnum = pgEnum('tx_status', ['pending', 'confirmed', 'deleted'])

export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  type: transactionTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
  description: text('description'),
  merchant: varchar('merchant', { length: 255 }),
  note: text('note'),
  source: txSourceEnum('source').default('manual').notNull(),
  status: txStatusEnum('status').default('confirmed').notNull(),
  date: timestamp('date').notNull(),

  // Auto-categorization metadata
  categoryConfidence: numeric('category_confidence', { precision: 3, scale: 2 }),
  isManuallyEdited: boolean('is_manually_edited').default(false),
  isRecurring: boolean('is_recurring').default(false),
  recurringGroupId: uuid('recurring_group_id'),

  // Source metadata (email/notification)
  rawData: jsonb('raw_data'), // parsed email/notification data
  externalId: varchar('external_id', { length: 255 }), // for dedup
  idempotencyKey: varchar('idempotency_key', { length: 255 }).unique(),

  // Transfer link
  transferPairId: uuid('transfer_pair_id'),

  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('tx_user_date_idx').on(t.userId, t.date),
  index('tx_user_category_idx').on(t.userId, t.categoryId),
  index('tx_user_account_idx').on(t.userId, t.accountId),
  index('tx_idempotency_idx').on(t.idempotencyKey),
])

export const transactionAuditLog = pgTable('transaction_audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  transactionId: uuid('transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 50 }).notNull(), // create, update, delete, categorize
  before: jsonb('before'),
  after: jsonb('after'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
}))

export type Transaction = typeof transactions.$inferSelect
export type NewTransaction = typeof transactions.$inferInsert
