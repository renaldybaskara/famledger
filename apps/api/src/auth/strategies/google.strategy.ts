import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy, VerifyCallback } from 'passport-google-oauth20'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get('GOOGLE_CLIENT_ID', 'placeholder'),
      clientSecret: config.get('GOOGLE_CLIENT_SECRET', 'placeholder'),
      callbackURL: config.get('GOOGLE_CALLBACK_URL', 'http://localhost:4000/api/auth/google/callback'),
      scope: ['email', 'profile'],
    })
  }

  validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback) {
    const { id, displayName, emails, photos } = profile
    done(null, {
      sub: id,
      email: emails?.[0]?.value,
      name: displayName,
      picture: photos?.[0]?.value,
    })
  }
}
