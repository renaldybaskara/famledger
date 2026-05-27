import {
  Injectable, UnauthorizedException, ConflictException, BadRequestException
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as argon2 from 'argon2'
import { UsersService } from '../users/users.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email)
    if (existing) throw new ConflictException('Email sudah terdaftar')

    const passwordHash = await argon2.hash(dto.password)
    const user = await this.usersService.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
      authProvider: 'email',
    })

    const tokens = await this.generateTokens(user.id, user.email)
    await this.usersService.saveRefreshToken(user.id, tokens.refreshToken)

    return { user: this.sanitizeUser(user), ...tokens }
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email)
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Email atau password salah')
    }

    const isValid = await argon2.verify(user.passwordHash, dto.password)
    if (!isValid) throw new UnauthorizedException('Email atau password salah')

    const tokens = await this.generateTokens(user.id, user.email)
    await this.usersService.saveRefreshToken(user.id, tokens.refreshToken)

    return { user: this.sanitizeUser(user), ...tokens }
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const isValid = await this.usersService.validateRefreshToken(userId, refreshToken)
    if (!isValid) throw new UnauthorizedException('Refresh token tidak valid')

    const user = await this.usersService.findById(userId)
    if (!user) throw new UnauthorizedException()

    const tokens = await this.generateTokens(user.id, user.email)
    await this.usersService.rotateRefreshToken(userId, refreshToken, tokens.refreshToken)

    return { user: this.sanitizeUser(user), ...tokens }
  }

  async logout(userId: string, refreshToken: string) {
    await this.usersService.revokeRefreshToken(userId, refreshToken)
    return { message: 'Berhasil logout' }
  }

  async googleLogin(googleUser: any) {
    let user = await this.usersService.findByEmail(googleUser.email)

    if (!user) {
      user = await this.usersService.create({
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: googleUser.picture,
        authProvider: 'google',
        googleId: googleUser.sub,
        isEmailVerified: true,
      })
    }

    const tokens = await this.generateTokens(user.id, user.email)
    await this.usersService.saveRefreshToken(user.id, tokens.refreshToken)

    return { user: this.sanitizeUser(user), ...tokens }
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '30d'),
      }),
    ])

    return { accessToken, refreshToken }
  }

  sanitizeUser(user: any) {
    const { passwordHash, emailVerificationToken, passwordResetToken, twoFactorSecret, ...safe } = user
    return safe
  }
}
