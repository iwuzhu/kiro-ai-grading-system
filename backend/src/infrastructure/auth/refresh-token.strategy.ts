/**
 * Refresh Token Strategy for Passport
 *
 * Implements Passport's JWT strategy for refresh tokens.
 * Extracts refresh token from secure cookie or request body,
 * validates it, and allows token refresh endpoint to issue new access token.
 *
 * Usage in guards:
 * @UseGuards(AuthGuard('jwt-refresh'))
 * async refresh(@Request() req) {
 *   return req.user; // Contains user info from refresh token
 * }
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtTokenService } from './jwt.service';
import { AuthenticatedUser, TokenClaims } from './types';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtTokenService,
  ) {
    super({
      // Custom extraction: try cookie first, then body
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          // Try to get from refresh_token cookie (secure, HttpOnly)
          const cookie = req.cookies?.refresh_token;
          if (cookie) return cookie;

          // Fallback: try request body (for non-cookie environments)
          const body = req.body as { refresh_token?: string };
          if (body?.refresh_token) return body.refresh_token;

          return null;
        },
      ]),

      // Don't let passport verify initially - we'll validate manually
      ignoreExpiration: false,

      // Use JWT_REFRESH_SECRET
      secretOrKey: configService.getOrThrow('JWT_REFRESH_SECRET'),

      // Pass the full request to validate method
      passReqToCallback: true,
    });
  }

  /**
   * Passport calls this after JWT signature is verified
   * Validates refresh token claims and returns user context
   *
   * @param req - Express request (for additional context)
   * @param claims - Decoded JWT payload
   * @returns User context for refresh operation
   * @throws UnauthorizedException if validation fails
   */
  async validate(req: Request, claims: TokenClaims): Promise<AuthenticatedUser> {
    // Verify this is a refresh token, not an access token
    if (claims.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type (expected refresh token)');
    }

    // Verify required fields exist
    if (!claims.sub || !claims.tenant_id) {
      throw new UnauthorizedException('Invalid token claims');
    }

    // Note: Refresh tokens don't include email/role/permissions
    // These are fetched from database during refresh endpoint
    return {
      id: claims.sub,
      email: '', // Will be fetched during refresh
      tenant_id: claims.tenant_id,
      role: claims.role,
      permissions: [],
    };
  }
}
