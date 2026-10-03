/**
 * Authentication Controller
 *
 * REST endpoints for user authentication and token management:
 * - POST /auth/login - Local login (email + password)
 * - POST /auth/refresh - Token refresh via refresh token cookie
 * - POST /auth/logout - Logout (clear refresh token cookie)
 * - GET /auth/sso/okta/callback - Okta OAuth2 callback (scaffolded)
 * - GET /auth/sso/azure/callback - Azure AD OAuth2 callback (scaffolded)
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  UseGuards,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { JwtTokenService } from './jwt.service';
import { LoginRequest, AuthResponse, AuthenticatedUser, UserRole } from './types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRepository } from '../../domain/repositories/user.repository';
import * as bcrypt from 'bcrypt';

/**
 * Cookie configuration for secure refresh token storage
 * - HttpOnly: Cannot be accessed via JavaScript (prevents XSS attacks)
 * - Secure: Only sent over HTTPS
 * - SameSite: Strict - only sent with same-site requests (prevents CSRF)
 * - Max-Age: 30 days (2592000 seconds)
 * - Path: / (available site-wide)
 */
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // Only HTTPS in production
  sameSite: 'strict' as const,
  maxAge: 2592000000, // 30 days in milliseconds
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly jwtService: JwtTokenService,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Local Login Endpoint
   *
   * POST /auth/login
   * Authenticates user with email and password.
   *
   * Request body:
   * {
   *   "email": "user@example.com",
   *   "password": "password123"
   * }
   *
   * Response:
   * {
   *   "access_token": "eyJhbGc...",
   *   "refresh_token": "eyJhbGc...",
   *   "token_type": "Bearer",
   *   "expires_in": 3600,
   *   "user": {
   *     "id": "uuid",
   *     "email": "user@example.com",
   *     "role": "INSTRUCTOR",
   *     "tenant_id": "uuid"
   *   }
   * }
   *
   * Refresh token is also set in secure HttpOnly cookie.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() credentials: LoginRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    console.log('\n=== LOGIN ATTEMPT ===');
    console.log(`Email: ${credentials.email}`);
    
    // Validate input
    if (!credentials.email || !credentials.password) {
      console.log('❌ Missing credentials');
      throw new BadRequestException('Email and password are required');
    }

    // TODO: For MVP, we'll use a hardcoded institution ID for testing
    // In production, institution_id would be determined by email domain or subdomain
    const TEST_INSTITUTION_ID = '550e8400-e29b-41d4-a716-446655440000';
    console.log(`Tenant ID: ${TEST_INSTITUTION_ID}`);

    try {
      // Find user by email - note: in a real system, we'd need to determine tenant_id from domain
      // For now, using test institution
      console.log(`Finding user by email: ${credentials.email}`);
      const user = await this.userRepository.findByEmail(TEST_INSTITUTION_ID, credentials.email);

      if (!user) {
        console.log(`❌ User NOT found in database`);
        throw new UnauthorizedException('Invalid email or password');
      }

      console.log(`✓ User found: ID=${user.id}, Email=${user.email}, Status=${user.status}`);
      console.log(`  Password hash exists: ${!!user.password_hash}`);
      console.log(`  Password hash (first 20 chars): ${user.password_hash?.substring(0, 20)}`);

      if (user.status !== 'ACTIVE') {
        console.log(`❌ User status is not ACTIVE: ${user.status}`);
        throw new UnauthorizedException('User account is not active');
      }

      // Verify password
      console.log(`Comparing passwords...`);
      console.log(`Provided password: ${credentials.password}`);
      console.log(`Stored hash (first 20 chars): ${user.password_hash?.substring(0, 20)}`);
      
      const passwordMatches = await bcrypt.compare(credentials.password, user.password_hash || '');
      console.log(`Password match result: ${passwordMatches}`);

      if (!passwordMatches) {
        console.log(`❌ Password mismatch`);
        throw new UnauthorizedException('Invalid email or password');
      }

      console.log(`✓ Password verified successfully`);

      // Update last login timestamp (non-blocking - don't fail login if this errors)
      try {
        await this.userRepository.updateLastLogin(user.tenant_id, user.id);
        console.log(`✓ Last login timestamp updated`);
      } catch (err) {
        // Log but don't throw - last login tracking is not critical for authentication
        console.warn('⚠️ Failed to update last login timestamp:', err.message);
      }

      // Generate token pair using JWT service
      console.log(`Generating token pair...`);
      const response = this.jwtService.createTokenPair({
        id: user.id,
        email: user.email,
        tenant_id: user.tenant_id,
        role: user.role as UserRole,
        permissions: user.permissions || [],
      });
      console.log(`✓ Token pair generated`);

      // Set refresh token in secure cookie
      res.cookie('refresh_token', response.refresh_token, REFRESH_COOKIE_OPTIONS);
      console.log(`✓ Refresh token set in cookie`);
      console.log(`✓ Login successful!\n`);

      return response;
    } catch (error) {
      console.log(`❌ Login failed with error: ${error.message}`);
      console.log(`Error type: ${error.constructor.name}\n`);
      
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Token Refresh Endpoint
   *
   * POST /auth/refresh
   * Issues new access token if current refresh token is valid.
   * Refresh token can be provided as:
   * - Secure HttpOnly cookie (preferred)
   * - Request body (fallback for non-cookie environments)
   *
   * Request body (optional, if refresh token not in cookie):
   * {
   *   "refresh_token": "eyJhbGc..."
   * }
   *
   * Response:
   * {
   *   "access_token": "eyJhbGc...",
   *   "token_type": "Bearer",
   *   "expires_in": 3600
   * }
   *
   * If refresh token < 7 days from expiration, new refresh token
   * is also issued (both in response and in secure cookie).
   */
  @Post('refresh')
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(HttpStatus.OK)
  async refresh(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    // TODO: Implement refresh with UserService
    // 1. Fetch user from database (to get latest role/permissions)
    // 2. Generate new access token
    // 3. Check if refresh token < 7 days to expiration
    // 4. If yes: generate new refresh token and set in cookie
    // 5. Return tokens

    // Placeholder implementation
    throw new UnauthorizedException('Refresh token endpoint not yet implemented');
  }

  /**
   * Logout Endpoint
   *
   * POST /auth/logout
   * Clears refresh token cookie (client also discards access token).
   *
   * No request body required.
   *
   * Response:
   * {
   *   "message": "Successfully logged out"
   * }
   *
   * Note: JWT tokens cannot be revoked server-side (stateless).
   * Logout only removes the refresh token cookie. Access token remains
   * valid until expiration (1 hour), but cannot be refreshed.
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    // Clear refresh token cookie
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return {
      message: 'Successfully logged out',
    };
  }

  /**
   * Okta OAuth2 Callback
   *
   * GET /auth/sso/okta/callback
   * Handles OAuth2 callback from Okta after user grants permission.
   *
   * Query params (set by Okta):
   * - code: Authorization code (exchanged for access token)
   * - state: CSRF token for validation
   *
   * Response: Redirect to frontend with token in URL fragment
   * Location: https://app.example.com/auth-complete#access_token=...&refresh_token=...
   *
   * On frontend:
   * - Extract tokens from URL fragment
   * - Store access token in memory
   * - Store refresh token in secure storage (cookie via refresh endpoint)
   * - Redirect to dashboard
   *
   * Implementation Notes:
   * - Uses Passport OAuth2 strategy with Okta provider
   * - Okta returns user info in profile (id, email, name)
   * - System creates user if doesn't exist (first login)
   * - User's institution determined by email domain mapping or Okta custom claims
   *
   * @todo Implement full OAuth2 flow with actual strategy
   * @todo Add email domain to institution mapping
   * @todo Add error handling and redirect on failure
   */
  @Get('sso/okta/callback')
  async oktaCallback(@Res() res: Response) {
    // TODO: Implement Okta OAuth2 callback
    // This is scaffolded for integration during deployment

    res.status(501).json({
      error: 'Okta SSO callback not yet implemented',
      message:
        'Okta OAuth2 integration will be configured during deployment with Okta tenant credentials',
    });
  }

  /**
   * Azure AD OAuth2 Callback
   *
   * GET /auth/sso/azure/callback
   * Handles OAuth2 callback from Azure AD after user grants permission.
   *
   * Query params (set by Azure AD):
   * - code: Authorization code (exchanged for access token)
   * - state: CSRF token for validation
   *
   * Response: Redirect to frontend with token in URL fragment
   *
   * Implementation Notes:
   * - Uses Passport OAuth2 strategy with Azure AD provider
   * - Azure AD returns user info in profile (oid, email, name, groups)
   * - System creates user if doesn't exist
   * - User's institution determined by Azure AD tenant or groups
   *
   * @todo Implement full OAuth2 flow with actual strategy
   * @todo Add Azure AD tenant to institution mapping
   * @todo Support Azure AD groups for role assignment
   */
  @Get('sso/azure/callback')
  async azureCallback(@Res() res: Response) {
    // TODO: Implement Azure AD OAuth2 callback
    // This is scaffolded for integration during deployment

    res.status(501).json({
      error: 'Azure AD SSO callback not yet implemented',
      message:
        'Azure AD OAuth2 integration will be configured during deployment with Azure AD credentials',
    });
  }

  /**
   * Get Current User Endpoint
   *
   * GET /auth/me
   * Returns the current authenticated user's info from JWT.
   *
   * Response:
   * {
   *   "id": "uuid",
   *   "email": "user@example.com",
   *   "role": "INSTRUCTOR",
   *   "tenant_id": "uuid",
   *   "permissions": ["courses:create", "assignments:manage"]
   * }
   *
   * Useful for:
   * - Frontend to verify user is authenticated
   * - Refresh user context after token refresh
   * - Check user's role and permissions
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getCurrentUser(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}


