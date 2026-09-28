import { SetMetadata } from '@nestjs/common';

/**
 * @PublicEndpoint Decorator
 *
 * Marks an endpoint as public (no authentication required).
 * Used to bypass the JWT authentication guard for specific routes.
 *
 * Public endpoints typically include:
 * - Authentication routes (login, register, forgot password)
 * - Health checks
 * - Documentation endpoints
 * - Public API information
 *
 * When applied, the endpoint skips:
 * - JWT verification
 * - User extraction
 * - Tenant context validation
 * - Role/permission checks
 *
 * Usage:
 * @Post('/auth/login')
 * @PublicEndpoint()
 * async login(@Body() dto: LoginDto) { }
 *
 * @Post('/auth/register')
 * @PublicEndpoint()
 * async register(@Body() dto: RegisterDto) { }
 *
 * @Get('/health')
 * @PublicEndpoint()
 * async health() { }
 *
 * The JWT guard checks for this decorator and skips authentication if present.
 */
export const PUBLIC_ENDPOINT_KEY = 'public';

/**
 * Decorator to mark an endpoint as public (no authentication required)
 */
export function PublicEndpoint(): MethodDecorator {
  return SetMetadata(PUBLIC_ENDPOINT_KEY, true);
}
