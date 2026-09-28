/**
 * JWT Strategy for Passport
 *
 * Implements Passport's JWT strategy to validate access tokens
 * on incoming requests. Extracts JWT from Authorization header,
 * validates signature and expiration, and attaches user context to request.
 *
 * Usage in guards:
 * @UseGuards(AuthGuard('jwt'))
 * async getProfile(@Request() req) {
 *   return req.user; // Contains: id, email, tenant_id, role, permissions
 * }
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtTokenService } from './jwt.service';
import { AuthenticatedUser, TokenClaims } from './types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtTokenService,
  ) {
    super({
      // Extract JWT from 'Authorization: Bearer <token>' header
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // Don't let passport verify - we'll do it manually for better error handling
      ignoreExpiration: false,

      // Use JWT_SECRET from environment
      secretOrKey: configService.getOrThrow('JWT_SECRET'),
    });
  }

  /**
   * Passport calls this after JWT signature is verified
   * Validates token claims and returns user context
   *
   * @param claims - Decoded JWT payload (TokenClaims)
   * @returns User context for request (req.user)
   * @throws UnauthorizedException if validation fails
   */
  async validate(claims: TokenClaims): Promise<AuthenticatedUser> {
    // Verify this is an access token, not a refresh token
    if (claims.type !== 'access') {
      throw new UnauthorizedException('Invalid token type (expected access token)');
    }

    // Verify required fields exist
    if (!claims.sub || !claims.email || !claims.tenant_id || !claims.role) {
      throw new UnauthorizedException('Invalid token claims');
    }

    // Verify permissions array exists (can be empty for minimal permissions)
    if (!Array.isArray(claims.permissions)) {
      throw new UnauthorizedException('Invalid permissions claim');
    }

    return {
      id: claims.sub,
      email: claims.email,
      tenant_id: claims.tenant_id,
      role: claims.role,
      permissions: claims.permissions,
    };
  }
}
