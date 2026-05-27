import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { IsString, IsEnum, IsOptional, IsDateString, IsUUID, IsNumber, IsPositive } from 'class-validator'
import { Type } from 'class-transformer'
import { TransactionsService } from './transactions.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

class CreateTransactionDto {
  @IsEnum(['income', 'expense', 'transfer']) type: any
  @IsString() amount: string
  @IsDateString() date: string
  @IsOptional() @IsUUID() categoryId?: string
  @IsOptional() @IsUUID() accountId?: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsString() merchant?: string
  @IsOptional() @IsString() note?: string
  @IsOptional() @IsString() currency?: string
}

class ListTransactionsDto {
  @IsOptional() @Type(() => Number) @IsNumber() page?: number
  @IsOptional() @Type(() => Number) @IsNumber() limit?: number
  @IsOptional() @IsEnum(['income', 'expense', 'transfer']) type?: any
  @IsOptional() @IsDateString() startDate?: string
  @IsOptional() @IsDateString() endDate?: string
  @IsOptional() @IsUUID() categoryId?: string
  @IsOptional() @IsUUID() accountId?: string
  @IsOptional() @IsString() search?: string
}

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private txService: TransactionsService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: ListTransactionsDto) {
    return this.txService.findAll(user.id, query)
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.txService.findById(user.id, id)
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateTransactionDto) {
    return this.txService.create(user.id, {
      ...dto,
      date: new Date(dto.date),
      source: 'manual',
    } as any)
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: Partial<CreateTransactionDto>) {
    const data = { ...dto } as any
    if (dto.date) data.date = new Date(dto.date)
    return this.txService.update(user.id, id, data)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.txService.delete(user.id, id)
  }
}
