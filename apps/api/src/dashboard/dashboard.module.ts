import { Module } from '@nestjs/common'
import { DashboardController } from './dashboard.controller'
import { TransactionsModule } from '../transactions/transactions.module'

@Module({
  imports: [TransactionsModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
