import { Inject, Injectable } from '@nestjs/common'
import { eq, and } from 'drizzle-orm'
import { DB_TOKEN } from '../database/database.module'
import { DbClient, accounts, type NewAccount } from '@fintrackr/db'

@Injectable()
export class AccountsService {
  constructor(@Inject(DB_TOKEN) private db: DbClient) {}

  async findAll(userId: string) {
    return this.db.select().from(accounts).where(
      and(eq(accounts.userId, userId), eq(accounts.isActive, true))
    )
  }

  async create(userId: string, data: Omit<NewAccount, 'userId'>) {
    const [account] = await this.db
      .insert(accounts)
      .values({ ...data, userId })
      .returning()
    return account
  }

  async update(userId: string, id: string, data: Partial<NewAccount>) {
    const [account] = await this.db
      .update(accounts)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .returning()
    return account
  }

  async delete(userId: string, id: string) {
    await this.db
      .update(accounts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    return { message: 'Akun berhasil dihapus' }
  }
}
