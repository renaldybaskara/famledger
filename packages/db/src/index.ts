import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export * from './schema'
export { schema }

export function createDb(connectionString: string) {
  const client = postgres(connectionString, { max: 10 })
  return drizzle(client, { schema, logger: process.env.NODE_ENV === 'development' })
}

export type DbClient = ReturnType<typeof createDb>
