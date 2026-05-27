import { Module } from '@nestjs/common'
import { BudgetsService } from './budgets.service'
import { BudgetsController } from './budgets.controller'
import { TransactionsModule } from '../transactions/transactions.module'

@Module({
  imports: [TransactionsModule],
  providers: [BudgetsService],
  controllers: [BudgetsController],
})
export class BudgetsModule {}
