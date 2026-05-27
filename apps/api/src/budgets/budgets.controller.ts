import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { IsString, IsOptional, IsUUID, IsEnum, IsDateString, IsBoolean } from 'class-validator'
import { BudgetsService } from './budgets.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

class CreateBudgetDto {
  @IsString() name: string
  @IsString() amount: string
  @IsOptional() @IsUUID() categoryId?: string
  @IsEnum(['monthly', 'weekly', 'yearly', 'custom']) period: any
  @IsDateString() startDate: string
  @IsOptional() @IsDateString() endDate?: string
  @IsOptional() @IsBoolean() carryOver?: boolean
}

@ApiTags('budgets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private budgetsService: BudgetsService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.budgetsService.findAll(user.id)
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateBudgetDto) {
    return this.budgetsService.create(user.id, {
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    } as any)
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: Partial<CreateBudgetDto>) {
    return this.budgetsService.update(user.id, id, dto as any)
  }

  @Delete(':id')
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.budgetsService.delete(user.id, id)
  }

  @Get('subscriptions')
  findSubscriptions(@CurrentUser() user: any) {
    return this.budgetsService.findSubscriptions(user.id)
  }
}
