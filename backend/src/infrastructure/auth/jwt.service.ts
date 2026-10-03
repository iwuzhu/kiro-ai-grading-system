/**
 * JWT Service
 * Handles JWT token generation, validation, and refresh token lifecycle
 *
 * Responsibilities:
 * - Generate access tokens (1 hour expiration)
 * - Generate refresh tokens (30 days expiration)
 * - Validate token signatures and expiration
 * - Refresh expired access tokens
 * - Handle token revocation (logout)
 */

import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, TokenClaims, AuthResponse, UserRole } from './types';

@Injectable()
export class JwtTokenService {
  // Token expiration times (in seconds)
  private readonly ACCESS_TOKEN_EXPIRATION = 3600; // 1 hour
  private readonly REFRESH_TOKEN_EXPIRATION = 2592000; // 30 days

  constructor(
    private readonly jwtService: NestJwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate access token
   *
   * @param payload - JWT payload with user info
   * @returns Signed JWT access token
   *
   * Token includes:
   * - sub: user ID
   * - email: user email
   * - tenant_id: institution UUID
   * - role: user role
   * - permissions: array of granular permissions
   * - iat: issued at timestamp (added by JWT library)
   * - exp: expiration timestamp (added by JWT library, current time + 1 hour)
   * - type: access token type
   */
  generateAccessToken(payload: JwtPayload): string {
    const claims = {
      ...payload,
      type: 'access' as const,
    };

    return this.jwtService.sign(claims, {
      secret: this.configService.getOrThrow('JWT_SECRET'),
      expiresIn: this.ACCESS_TOKEN_EXPIRATION,
    });
  }

  /**
   * Generate refresh token
   *
   * @param userId - User UUID
   * @param tenantId - Tenant UUID
   * @returns Signed JWT refresh token
   *
   * Token includes:
   * - sub: user ID
   * - tenant_id: institution UUID
   * - type: 'refresh'
   * - iat: issued at timestamp (added by JWT library)
   * - exp: expiration timestamp (added by JWT library, current time + 30 days)
   */
  generateRefreshToken(userId: string, tenantId: string): string {
    const claims = {
      sub: userId,
      email: '', // Not included in refresh token
      tenant_id: tenantId,
      role: UserRole.STUDENT, // Placeholder, verified during refresh
      permissions: [],
      type: 'refresh' as const,
    };

    return this.jwtService.sign(claims, {
      secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.REFRESH_TOKEN_EXPIRATION,
    });
  }

  /**
   * Create token pair (access + refresh) for login
   *
   * @param user - User entity or context
   * @returns AuthResponse with both tokens
   */
  createTokenPair(user: {
    id: string;
    email: string;
    tenant_id: string;
    role: UserRole;
    permissions: string[];
  }): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenant_id: user.tenant_id,
      role: user.role,
      permissions: user.permissions,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(user.id, user.tenant_id);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: this.ACCESS_TOKEN_EXPIRATION,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
      },
    };
  }

  /**
   * Validate and decode JWT token
   *
   * @param token - JWT token string (without 'Bearer ' prefix)
   * @param secret - Secret key to validate signature
   * @returns Decoded token claims
   * @throws UnauthorizedException if token invalid or expired
   */
  validateToken(token: string, secret: string): TokenClaims {
    try {
      return this.jwtService.verify(token, { secret });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token');
      }
      throw new UnauthorizedException('Token validation failed');
    }
  }

  /**
   * Validate access token
   *
   * @param token - JWT token string
   * @returns Decoded token claims
   * @throws UnauthorizedException if invalid/expired
   */
  validateAccessToken(token: string): TokenClaims {
    return this.validateToken(token, this.configService.getOrThrow('JWT_SECRET'));
  }

  /**
   * Validate refresh token
   *
   * @param token - JWT token string
   * @returns Decoded token claims
   * @throws UnauthorizedException if invalid/expired
   */
  validateRefreshToken(token: string): TokenClaims {
    const claims = this.validateToken(
      token,
      this.configService.getOrThrow('JWT_REFRESH_SECRET'),
    );

    // Verify this is a refresh token, not an access token
    if (claims.type !== 'refresh') {
      throw new BadRequestException('Invalid token type');
    }

    return claims;
  }

  /**
   * Decode token without validation (for error handling)
   * WARNING: Only use for error messages/logging, not for authorization
   *
   * @param token - JWT token string
   * @returns Decoded claims or null if invalid
   */
  decodeToken(token: string): TokenClaims | null {
    try {
      return this.jwtService.decode(token) as TokenClaims;
    } catch {
      return null;
    }
  }

  /**
   * Check if refresh token should be re-issued
   * Re-issue if < 7 days remaining on refresh token
   *
   * @param refreshToken - JWT refresh token
   * @returns True if should re-issue (< 7 days remaining)
   */
  shouldRefreshToken(refreshToken: string): boolean {
    const claims = this.decodeToken(refreshToken);
    if (!claims || !claims.exp) return false;

    const currentTime = Math.floor(Date.now() / 1000);
    const daysRemaining = (claims.exp - currentTime) / (24 * 60 * 60);

    return daysRemaining < 7;
  }

  /**
   * Extract token from Authorization header
   *
   * @param authHeader - Authorization header value (e.g., "Bearer token")
   * @returns Token without Bearer prefix, or null if invalid
   */
  extractTokenFromHeader(authHeader: string): string | null {
    if (!authHeader || typeof authHeader !== 'string') {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Get token expiration time
   *
   * @param token - JWT token
   * @returns Expiration timestamp (seconds since epoch) or null if invalid
   */
  getTokenExpiration(token: string): number | null {
    const claims = this.decodeToken(token);
    return claims?.exp ?? null;
  }

  /**
   * Get time until token expiration in seconds
   *
   * @param token - JWT token
   * @returns Seconds until expiration, or 0 if already expired
   */
  getTimeToExpiration(token: string): number {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return 0;

    const secondsUntilExpiration = expiration - Math.floor(Date.now() / 1000);
    return Math.max(0, secondsUntilExpiration);
  }
}
