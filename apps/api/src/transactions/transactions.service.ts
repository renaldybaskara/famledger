import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { eq, and, isNull, desc, gte, lte, ilike, sql, count } from 'drizzle-orm'
import { DB_TOKEN } from '../database/database.module'
import { DbClient, transactions, categories, accounts, type NewTransaction } from '@fintrackr/db'

export interface ListTransactionsQuery {
  page?: number
  limit?: number
  type?: 'income' | 'expense' | 'transfer'
  startDate?: string
  endDate?: string
  categoryId?: string
  accountId?: string
  search?: string
}

@Injectable()
export class TransactionsService {
  constructor(@Inject(DB_TOKEN) private db: DbClient) {}

  async findAll(userId: string, query: ListTransactionsQuery = {}) {
    const { page = 1, limit = 20, type, startDate, endDate, categoryId, accountId, search } = query
    const offset = (page - 1) * limit

    const conditions = [
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
    ]

    if (type) conditions.push(eq(transactions.type, type))
    if (startDate) conditions.push(gte(transactions.date, new Date(startDate)))
    if (endDate) conditions.push(lte(transactions.date, new Date(endDate)))
    if (categoryId) conditions.push(eq(transactions.categoryId, categoryId))
    if (accountId) conditions.push(eq(transactions.accountId, accountId))
    if (search) conditions.push(ilike(transactions.description, `%${search}%`))

    const [data, totalResult] = await Promise.all([
      this.db
        .select({
          transaction: transactions,
          category: { id: categories.id, name: categories.name, icon: categories.icon, color: categories.color },
          account: { id: accounts.id, name: accounts.name, bankCode: accounts.bankCode },
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .leftJoin(accounts, eq(transactions.accountId, accounts.id))
        .where(and(...conditions))
        .orderBy(desc(transactions.date))
        .limit(limit)
        .offset(offset),

      this.db
        .select({ count: count() })
        .from(transactions)
        .where(and(...conditions)),
    ])

    return {
      data: data.map(({ transaction, category, account }) => ({
        ...transaction,
        category,
        account,
      })),
      pagination: {
        page,
        limit,
        total: Number(totalResult[0]?.count ?? 0),
        totalPages: Math.ceil(Number(totalResult[0]?.count ?? 0) / limit),
      },
    }
  }

  async findById(userId: string, id: string) {
    const [result] = await this.db
      .select({
        transaction: transactions,
        category: { id: categories.id, name: categories.name, icon: categories.icon, color: categories.color },
        account: { id: accounts.id, name: accounts.name },
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId), isNull(transactions.deletedAt)))
      .limit(1)

    if (!result) throw new NotFoundException('Transaksi tidak ditemukan')
    return { ...result.transaction, category: result.category, account: result.account }
  }

  async create(userId: string, data: Omit<NewTransaction, 'userId'>) {
    const [tx] = await this.db
      .insert(transactions)
      .values({ ...data, userId })
      .returning()
    return tx
  }

  async update(userId: string, id: string, data: Partial<NewTransaction>) {
    const existing = await this.findById(userId, id)

    const [tx] = await this.db
      .update(transactions)
      .set({ ...data, isManuallyEdited: true, updatedAt: new Date() })
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning()

    return tx
  }

  async delete(userId: string, id: string) {
    await this.findById(userId, id)
    await this.db
      .update(transactions)
      .set({ deletedAt: new Date(), status: 'deleted', updatedAt: new Date() })
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    return { message: 'Transaksi dihapus' }
  }

  // --- Summary for dashboard ---
  async getSummary(userId: string, startDate?: Date, endDate?: Date) {
    const conditions = [eq(transactions.userId, userId), isNull(transactions.deletedAt)]
    if (startDate) conditions.push(gte(transactions.date, startDate))
    if (endDate) conditions.push(lte(transactions.date, endDate))

    const result = await this.db
      .select({
        type: transactions.type,
        total: sql<number>`COALESCE(SUM(${transactions.amount}::numeric), 0)`.as('total'),
        count: count(),
      })
      .from(transactions)
      .where(and(...conditions))
      .groupBy(transactions.type)

    const summary = { income: 0, expense: 0, transfer: 0, transactionCount: 0 }
    for (const row of result) {
      summary[row.type] = Number(row.total)
      summary.transactionCount += Number(row.count)
    }
    summary['net'] = summary.income - summary.expense

    return summary
  }

  // --- Category breakdown for pie chart ---
  async getCategoryBreakdown(userId: string, type: 'income' | 'expense', startDate?: Date, endDate?: Date) {
    const conditions = [
      eq(transactions.userId, userId),
      eq(transactions.type, type),
      isNull(transactions.deletedAt),
    ]
    if (startDate) conditions.push(gte(transactions.date, startDate))
    if (endDate) conditions.push(lte(transactions.date, endDate))

    return this.db
      .select({
        categoryId: categories.id,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
        total: sql<number>`COALESCE(SUM(${transactions.amount}::numeric), 0)`.as('total'),
        count: count(),
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(...conditions))
      .groupBy(categories.id, categories.name, categories.icon, categories.color)
      .orderBy(sql`total DESC`)
  }

  // --- Monthly trend for bar chart ---
  async getMonthlyTrend(userId: string, months = 6) {
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months + 1)
    startDate.setDate(1)
    startDate.setHours(0, 0, 0, 0)

    return this.db
      .select({
        month: sql<string>`TO_CHAR(${transactions.date}, 'YYYY-MM')`.as('month'),
        type: transactions.type,
        total: sql<number>`COALESCE(SUM(${transactions.amount}::numeric), 0)`.as('total'),
      })
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        gte(transactions.date, startDate),
      ))
      .groupBy(sql`TO_CHAR(${transactions.date}, 'YYYY-MM')`, transactions.type)
      .orderBy(sql`month ASC`, transactions.type)
  }
}
