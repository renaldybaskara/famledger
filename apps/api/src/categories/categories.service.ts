import { Inject, Injectable } from '@nestjs/common'
import { eq, or, isNull, and } from 'drizzle-orm'
import { DB_TOKEN } from '../database/database.module'
import { DbClient, categories, type NewCategory } from '@fintrackr/db'

@Injectable()
export class CategoriesService {
  constructor(@Inject(DB_TOKEN) private db: DbClient) {}

  /** Returns default (global) + user-specific categories */
  async findAll(userId: string) {
    return this.db
      .select()
      .from(categories)
      .where(
        and(
          or(isNull(categories.userId), eq(categories.userId, userId)),
          eq(categories.isActive, true)
        )
      )
      .orderBy(categories.sortOrder)
  }

  async create(userId: string, data: Omit<NewCategory, 'userId'>) {
    const [cat] = await this.db
      .insert(categories)
      .values({ ...data, userId })
      .returning()
    return cat
  }

  async update(userId: string, id: string, data: Partial<NewCategory>) {
    const [cat] = await this.db
      .update(categories)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning()
    return cat
  }

  async delete(userId: string, id: string) {
    await this.db
      .update(categories)
      .set({ isActive: false })
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    return { message: 'Kategori berhasil dihapus' }
  }
}
