import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { Logger } from 'nestjs-pino'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })

  // Logger
  app.useLogger(app.get(Logger))

  // CORS
  app.enableCors({
    origin: process.env.APP_URL || 'http://localhost:3000',
    credentials: true,
  })

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // API prefix
  app.setGlobalPrefix('api')

  // Swagger
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('FinTrackr API')
      .setDescription('Smart Financial Tracker - Self-Hosted')
      .setVersion('1.0')
      .addBearerAuth()
      .build()
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/docs', app, document)
  }

  const port = process.env.PORT || 4000
  await app.listen(port)
  console.log(`🚀 FinTrackr API running on port ${port}`)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📖 Swagger docs: http://localhost:${port}/api/docs`)
  }
}

bootstrap()
