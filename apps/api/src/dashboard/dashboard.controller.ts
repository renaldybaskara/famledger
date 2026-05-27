import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { IsOptional, IsDateString, IsEnum, IsNumber } from 'class-validator'
import { Type } from 'class-transformer'
import { TransactionsService } from '../transactions/transactions.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { startOfMonth, endOfMonth } from 'date-fns'

class DashboardQuery {
  @IsOptional() @IsDateString() startDate?: string
  @IsOptional() @IsDateString() endDate?: string
}

class CategoryBreakdownQuery extends DashboardQuery {
  @IsOptional() @IsEnum(['income', 'expense']) type?: 'income' | 'expense'
}

class TrendQuery {
  @IsOptional() @Type(() => Number) @IsNumber() months?: number
}

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private txService: TransactionsService) {}

  @Get('summary')
  summary(@CurrentUser() user: any, @Query() q: DashboardQuery) {
    const now = new Date()
    const start = q.startDate ? new Date(q.startDate) : startOfMonth(now)
    const end = q.endDate ? new Date(q.endDate) : endOfMonth(now)
    return this.txService.getSummary(user.id, start, end)
  }

  @Get('category-breakdown')
  categoryBreakdown(@CurrentUser() user: any, @Query() q: CategoryBreakdownQuery) {
    const now = new Date()
    const start = q.startDate ? new Date(q.startDate) : startOfMonth(now)
    const end = q.endDate ? new Date(q.endDate) : endOfMonth(now)
    return this.txService.getCategoryBreakdown(user.id, q.type ?? 'expense', start, end)
  }

  @Get('monthly-trend')
  monthlyTrend(@CurrentUser() user: any, @Query() q: TrendQuery) {
    return this.txService.getMonthlyTrend(user.id, q.months ?? 6)
  }
}
