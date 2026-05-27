import { Inject, Injectable } from '@nestjs/common'
import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { DB_TOKEN } from '../database/database.module'
import { DbClient, budgets, transactions, categories, subscriptions, type NewBudget } from '@fintrackr/db'
import { startOfMonth, endOfMonth } from 'date-fns'

@Injectable()
export class BudgetsService {
  constructor(@Inject(DB_TOKEN) private db: DbClient) {}

  async findAll(userId: string) {
    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)

    // Get budgets with current spending
    const budgetList = await this.db
      .select({
        budget: budgets,
        category: { id: categories.id, name: categories.name, icon: categories.icon, color: categories.color },
      })
      .from(budgets)
      .leftJoin(categories, eq(budgets.categoryId, categories.id))
      .where(and(eq(budgets.userId, userId), eq(budgets.isActive, true)))

    // Get current month spending per category
    const spending = await this.db
      .select({
        categoryId: transactions.categoryId,
        total: sql<number>`COALESCE(SUM(${transactions.amount}::numeric), 0)`.as('total'),
      })
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'expense'),
        gte(transactions.date, monthStart),
        lte(transactions.date, monthEnd),
      ))
      .groupBy(transactions.categoryId)

    const spendingMap = new Map(spending.map((s) => [s.categoryId, Number(s.total)]))

    return budgetList.map(({ budget, category }) => {
      const spent = spendingMap.get(budget.categoryId ?? '') ?? 0
      const limit = Number(budget.amount)
      return {
        ...budget,
        category,
        spent,
        remaining: Math.max(0, limit - spent),
        percentage: limit > 0 ? Math.round((spent / limit) * 100) : 0,
        status: spent > limit * 1.2 ? 'critical' : spent > limit ? 'over' : spent > limit * 0.8 ? 'warning' : 'ok',
      }
    })
  }

  async create(userId: string, data: Omit<NewBudget, 'userId'>) {
    const [budget] = await this.db.insert(budgets).values({ ...data, userId }).returning()
    return budget
  }

  async update(userId: string, id: string, data: Partial<NewBudget>) {
    const [budget] = await this.db
      .update(budgets)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .returning()
    return budget
  }

  async delete(userId: string, id: string) {
    await this.db
      .update(budgets)
      .set({ isActive: false })
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
    return { message: 'Budget dihapus' }
  }

  // --- Subscriptions ---
  async findSubscriptions(userId: string) {
    return this.db.select().from(subscriptions).where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.isActive, true))
    )
  }

  async createSubscription(userId: string, data: any) {
    const [sub] = await this.db.insert(subscriptions).values({ ...data, userId }).returning()
    return sub
  }
}
