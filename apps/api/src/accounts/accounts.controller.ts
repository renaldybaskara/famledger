import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { IsString, IsEnum, IsOptional, MaxLength } from 'class-validator'
import { AccountsService } from './accounts.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

class CreateAccountDto {
  @IsString() @MaxLength(100) name: string
  @IsEnum(['bank', 'ewallet', 'cash', 'credit_card', 'investment']) type: any
  @IsOptional() @IsString() bankCode?: string
  @IsOptional() @IsString() accountNumber?: string
  @IsOptional() @IsString() color?: string
  @IsOptional() @IsString() icon?: string
}

@ApiTags('accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private accountsService: AccountsService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.accountsService.findAll(user.id)
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(user.id, dto)
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: Partial<CreateAccountDto>) {
    return this.accountsService.update(user.id, id, dto)
  }

  @Delete(':id')
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.accountsService.delete(user.id, id)
  }
}
