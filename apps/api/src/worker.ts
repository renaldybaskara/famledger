/**
 * FinTrackr BullMQ Worker entry point
 * Processes async jobs: email parsing, LLM categorization, notifications
 */
import { NestFactory } from '@nestjs/core'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { BullModule, Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { DatabaseModule } from './database/database.module'

// ── Categorization Worker ────────────────────────────────────
@Processor('categorization')
class CategorizationWorker extends WorkerHost {
  async process(job: Job) {
    console.log(`[Worker] Processing categorization job ${job.id}`)
    const { transactionId, description, merchant } = job.data

    // TODO Phase 1: Rule-based categorization
    // TODO Phase 2: Ollama LLM categorization
    console.log(`[Worker] Categorizing tx ${transactionId}: "${merchant || description}"`)
    return { status: 'processed' }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    console.log(`[Worker] Job ${job.id} completed`)
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    console.error(`[Worker] Job ${job.id} failed:`, error.message)
  }
}

// ── Email Parsing Worker ─────────────────────────────────────
@Processor('email-parsing')
class EmailParsingWorker extends WorkerHost {
  async process(job: Job) {
    console.log(`[Worker] Processing email-parsing job ${job.id}`)
    const { emailId, userId, provider } = job.data
    // TODO Phase 1: Parse email → create transaction
    return { status: 'processed' }
  }
}

// ── Worker App Module ────────────────────────────────────────
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    DatabaseModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: 'categorization' },
      { name: 'email-parsing' },
    ),
  ],
  providers: [CategorizationWorker, EmailParsingWorker],
})
class WorkerAppModule {}

async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    logger: ['error', 'warn', 'log'],
  })
  console.log('🔧 FinTrackr Worker started — listening for jobs...')

  process.on('SIGTERM', async () => {
    console.log('Worker shutting down...')
    await app.close()
    process.exit(0)
  })
}

bootstrapWorker()
