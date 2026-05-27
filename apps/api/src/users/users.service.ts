import { Inject, Injectable } from '@nestjs/common'
import { eq, and, isNull, gt } from 'drizzle-orm'
import { DB_TOKEN } from '../database/database.module'
import { DbClient } from '@fintrackr/db'
import { users, refreshTokens, type NewUser } from '@fintrackr/db'
import { addDays } from 'date-fns'
import * as crypto from 'crypto'

@Injectable()
export class UsersService {
  constructor(@Inject(DB_TOKEN) private db: DbClient) {}

  async create(data: Partial<NewUser> & { email: string; name: string }) {
    const [user] = await this.db.insert(users).values(data as NewUser).returning()
    return user
  }

  async findById(id: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1)
    return user ?? null
  }

  async findByEmail(email: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1)
    return user ?? null
  }

  async update(id: string, data: Partial<typeof users.$inferInsert>) {
    const [user] = await this.db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()
    return user
  }

  async saveRefreshToken(userId: string, token: string) {
    await this.db.insert(refreshTokens).values({
      userId,
      token,
      expiresAt: addDays(new Date(), 30),
    })
  }

  async validateRefreshToken(userId: string, token: string) {
    const [rt] = await this.db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.userId, userId),
          eq(refreshTokens.token, token),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, new Date()),
        )
      )
      .limit(1)
    return !!rt
  }

  async rotateRefreshToken(userId: string, oldToken: string, newToken: string) {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), eq(refreshTokens.token, oldToken)))

    await this.saveRefreshToken(userId, newToken)
  }

  async revokeRefreshToken(userId: string, token: string) {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), eq(refreshTokens.token, token)))
  }

  async revokeAllRefreshTokens(userId: string) {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))
  }
}
