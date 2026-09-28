/**
 * Authentication Module
 *
 * NestJS module that configures and provides:
 * - JWT token service (creation, validation, refresh)
 * - Passport JWT strategy (access token validation)
 * - Passport refresh token strategy
 * - OAuth2 providers (scaffolded for Okta, Azure AD, Google)
 * - Auth controller (login, refresh, logout, SSO callbacks)
 *
 * Registration:
 * Import in AppModule:
 *   @Module({
 *     imports: [
 *       ConfigModule,
 *       PassportModule,
 *       JwtModule.register({ ... }),
 *       AuthModule,
 *     ],
 *   })
 *   export class AppModule {}
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { JwtTokenService } from './jwt.service';
import { JwtStrategy } from './jwt.strategy';
import { RefreshTokenStrategy } from './refresh-token.strategy';
import {
  OktaOAuth2Provider,
  AzureAdOAuth2Provider,
  GoogleOAuth2Provider,
  OAuth2StrategyFactory,
} from './sso.strategy';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    // Passport module (provides @UseGuards(AuthGuard(...)))
    PassportModule,

    // JWT module with configuration from environment
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],

  controllers: [AuthController],

  providers: [
    // JWT token service (core JWT logic)
    JwtTokenService,

    // Passport strategies
    JwtStrategy,
    RefreshTokenStrategy,

    // OAuth2 providers (scaffolded)
    OktaOAuth2Provider,
    AzureAdOAuth2Provider,
    GoogleOAuth2Provider,
    OAuth2StrategyFactory,
  ],

  exports: [
    // Export for use in other modules
    JwtTokenService,
    PassportModule,
    JwtModule,
  ],
})
export class AuthModule {}
