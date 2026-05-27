import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { IsString, IsEnum, IsOptional, MaxLength, IsInt } from 'class-validator'
import { CategoriesService } from './categories.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

class CreateCategoryDto {
  @IsString() @MaxLength(100) name: string
  @IsOptional() @IsString() nameEn?: string
  @IsString() icon: string
  @IsString() color: string
  @IsEnum(['income', 'expense', 'transfer']) type: any
  @IsOptional() @IsInt() sortOrder?: number
}

@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.categoriesService.findAll(user.id)
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(user.id, dto)
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: Partial<CreateCategoryDto>) {
    return this.categoriesService.update(user.id, id, dto)
  }

  @Delete(':id')
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.categoriesService.delete(user.id, id)
  }
}
