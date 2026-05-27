import { Module, Global } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createDb, schema } from '@fintrackr/db'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

export const DB_TOKEN = 'DRIZZLE_DB'

@Global()
@Module({
  providers: [
    {
      provide: DB_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const connectionString = config.getOrThrow<string>('DATABASE_URL')
        const client = postgres(connectionString, { max: 10 })
        return drizzle(client, {
          schema,
          logger: config.get('NODE_ENV') === 'development',
        })
      },
    },
  ],
  exports: [DB_TOKEN],
})
export class DatabaseModule {}
