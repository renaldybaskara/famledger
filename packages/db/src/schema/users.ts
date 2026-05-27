import {
  pgTable, uuid, varchar, text, boolean, timestamp, pgEnum, integer
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const userTierEnum = pgEnum('user_tier', ['free', 'premium', 'family', 'business'])
export const authProviderEnum = pgEnum('auth_provider', ['email', 'google', 'apple'])

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  name: varchar('name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  tier: userTierEnum('tier').default('free').notNull(),
  authProvider: authProviderEnum('auth_provider').default('email').notNull(),
  googleId: varchar('google_id', { length: 255 }),
  isEmailVerified: boolean('is_email_verified').default(false).notNull(),
  emailVerificationToken: varchar('email_verification_token', { length: 255 }),
  passwordResetToken: varchar('password_reset_token', { length: 255 }),
  passwordResetExpires: timestamp('password_reset_expires'),
  twoFactorSecret: varchar('two_factor_secret', { length: 255 }),
  twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),
  selfHostedAdmin: boolean('self_hosted_admin').default(false).notNull(),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 512 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const usersRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
