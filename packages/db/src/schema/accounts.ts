import {
  pgTable, uuid, varchar, text, boolean, timestamp, pgEnum, numeric, integer
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'

export const accountTypeEnum = pgEnum('account_type', [
  'bank', 'ewallet', 'cash', 'credit_card', 'investment'
])

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: accountTypeEnum('type').notNull(),
  bankCode: varchar('bank_code', { length: 50 }),  // BCA, MANDIRI, BRI, BNI, etc.
  accountNumber: varchar('account_number', { length: 50 }), // last 4 digits only
  balance: numeric('balance', { precision: 15, scale: 2 }).default('0').notNull(),
  currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
  color: varchar('color', { length: 7 }).default('#1A2B4A'),
  icon: varchar('icon', { length: 50 }).default('wallet'),
  isActive: boolean('is_active').default(true).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const emailIntegrations = pgTable('email_integrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(), // gmail, imap
  accessToken: text('access_token'), // encrypted
  refreshToken: text('refresh_token'), // encrypted
  watchResourceName: text('watch_resource_name'), // Gmail Pub/Sub watch
  watchExpiration: timestamp('watch_expiration'),
  imapHost: varchar('imap_host', { length: 255 }),
  imapPort: integer('imap_port'),
  imapUser: varchar('imap_user', { length: 255 }),
  imapPassword: text('imap_password'), // encrypted
  isActive: boolean('is_active').default(true).notNull(),
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert
