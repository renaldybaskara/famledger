import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { UsersService } from './users.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { IsOptional, IsString, MaxLength } from 'class-validator'

class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string
  @IsOptional() @IsString() avatarUrl?: string
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    const { passwordHash, ...safe } = user
    return safe
  }

  @Patch('profile')
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.update(user.id, dto)
  }
}
