# JWT Authentication Module

This module provides complete JWT-based authentication for the AI Grading System with support for local login, token refresh, and OAuth2 SSO integration.

## Overview

The authentication module implements:
- **JWT Access Tokens**: 1-hour expiration for API requests
- **Refresh Tokens**: 30-day expiration stored in secure HttpOnly cookies
- **Role-Based Access Control (RBAC)**: Enforce role and permission restrictions
- **Multi-Tenant Isolation**: Validate tenant context on every request
- **OAuth2/SSO Scaffolding**: Ready for Okta, Azure AD, and Google integration

## Architecture

### Token Structure

**Access Token** (JWT, 1 hour expiration):
```json
{
  "sub": "user-id-uuid",
  "email": "user@example.com",
  "tenant_id": "institution-uuid",
  "role": "INSTRUCTOR",
  "permissions": ["courses:create", "assignments:manage"],
  "type": "access",
  "iat": 1234567890,
  "exp": 1234571490
}
```

**Refresh Token** (JWT, 30 days expiration, stored in secure cookie):
```json
{
  "sub": "user-id-uuid",
  "tenant_id": "institution-uuid",
  "type": "refresh",
  "iat": 1234567890,
  "exp": 1234571490
}
```

### Module Organization

```
src/infrastructure/auth/
├── types.ts                      # Type definitions and enums
├── jwt.service.ts                # Token generation and validation
├── jwt.strategy.ts               # Passport JWT strategy (access tokens)
├── refresh-token.strategy.ts     # Passport refresh token strategy
├── sso.strategy.ts               # OAuth2 provider configuration (scaffolded)
├── auth.controller.ts            # REST endpoints
├── auth.module.ts                # NestJS module registration
├── jwt.service.spec.ts           # JWT service tests
└── auth.controller.spec.ts       # Controller tests

src/common/guards/
├── jwt-auth.guard.ts             # Validates JWT on protected routes
├── roles.guard.ts                # Enforces role restrictions
├── permissions.guard.ts          # Enforces granular permissions
├── tenant.guard.ts               # Validates tenant context
├── roles.guard.spec.ts           # Roles guard tests
├── permissions.guard.spec.ts     # Permissions guard tests
└── tenant.guard.spec.ts          # Tenant guard tests

src/common/decorators/
├── current-user.decorator.ts     # Injects authenticated user
├── current-tenant.decorator.ts   # Injects tenant_id
├── roles.decorator.ts            # Specifies required roles
└── permissions.decorator.ts      # Specifies required permissions
```

## Usage

### 1. Setup (in AppModule)

```typescript
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from './infrastructure/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env.local',
    }),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
    AuthModule,
  ],
})
export class AppModule {}
```

### 2. Environment Variables (.env.local)

```bash
# JWT Secrets (min 32 characters each)
JWT_SECRET=your-super-secret-key-min-32-characters-long!!
JWT_REFRESH_SECRET=your-refresh-secret-min-32-characters-long!!

# OAuth2 Providers (optional, configured during deployment)
OKTA_DOMAIN=dev-12345.okta.com
OKTA_CLIENT_ID=0oa...
OKTA_CLIENT_SECRET=secret...
OKTA_CALLBACK_URL=https://app.example.com/auth/sso/okta/callback

AZURE_AD_TENANT_ID=12345678-1234-1234-1234-123456789012
AZURE_AD_CLIENT_ID=87654321-4321-4321-4321-210987654321
AZURE_AD_CLIENT_SECRET=secret...
AZURE_AD_CALLBACK_URL=https://app.example.com/auth/sso/azure/callback
```

### 3. Protect Routes

#### Require Authentication Only
```typescript
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthenticatedUser } from 'src/infrastructure/auth/types';

@Controller('courses')
export class CoursesController {
  @UseGuards(JwtAuthGuard)
  @Get()
  async getCourses(@CurrentUser() user: AuthenticatedUser) {
    // Only authenticated users can access
    return { user: user.id };
  }
}
```

#### Require Specific Role
```typescript
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/infrastructure/auth/types';

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoursesController {
  @Post()
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  async createCourse(@Body() dto: CreateCourseDto) {
    // Only instructors and admins can create courses
  }
}
```

#### Require Specific Permission
```typescript
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';

@Controller('grades')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GradesController {
  @Post()
  @Permissions('grades:write', 'submissions:view')
  async createGrade(@Body() dto: CreateGradeDto) {
    // Only users with both permissions can access
  }
}
```

#### Require Tenant Match
```typescript
import { TenantGuard } from 'src/common/guards/tenant.guard';

@Controller('institutions/:institution_id/courses')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CoursesController {
  @Get()
  async getCourses(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    // User's tenant must match institution_id in URL
  }
}
```

### 4. Extract User Context

```typescript
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CurrentTenant } from 'src/common/decorators/current-tenant.decorator';
import { AuthenticatedUser } from 'src/infrastructure/auth/types';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  @Get()
  getProfile(
    @CurrentUser() user: AuthenticatedUser,        // Full user object
    @CurrentUser('id') userId: string,             // Just user ID
    @CurrentUser('email') email: string,           // Just email
    @CurrentTenant() tenantId: string,             // Just tenant ID
  ) {
    return {
      userId,
      email,
      tenantId,
      role: user.role,
      permissions: user.permissions,
    };
  }
}
```

## Authentication Flow

### 1. Local Login

```
Client                              Server
  │                                   │
  ├─ POST /auth/login              ──>│
  │  { email, password }              │
  │                                   │ Verify credentials (TODO: UserService)
  │                                   │ Generate token pair
  │<─ 200 OK                        ───┤
  │  {                                │
  │    access_token,                  │
  │    refresh_token (in cookie),     │
  │    user: { id, email, role }      │
  │  }                                │
```

### 2. Authenticated API Request

```
Client                              Server
  │                                   │
  ├─ GET /api/v1/courses          ──>│
  │  Authorization: Bearer {token}    │
  │                                   │ JwtAuthGuard validates token
  │                                   │ RolesGuard checks role
  │                                   │ TenantGuard validates tenant
  │                                   │ Process request
  │<─ 200 OK [course data]         ───┤
```

### 3. Token Refresh

```
Client                              Server
  │                                   │
  ├─ POST /auth/refresh           ──>│
  │  (refresh_token in HttpOnly cookie)│
  │                                   │ Validate refresh token
  │                                   │ Fetch user from DB
  │                                   │ Generate new access token
  │                                   │ Optionally re-issue refresh token
  │<─ 200 OK                       ───┤
  │  {                                │
  │    access_token (new),            │
  │    expires_in: 3600               │
  │  }                                │
```

### 4. Logout

```
Client                              Server
  │                                   │
  ├─ POST /auth/logout            ──>│
  │  Authorization: Bearer {token}    │
  │                                   │ Clear refresh token cookie
  │<─ 200 OK                       ───┤
  │  { message: "logged out" }        │
  │                                   │
  │ Client discards access token      │
```

## Roles and Permissions

### Predefined Roles

**Admin Role**
- Full institution control
- Can manage users, settings, policies
- Can override grades and override plagiarism decisions
- Permissions: `institution:admin`, `users:manage`, `settings:write`, `audit_logs:read`, etc.

**Instructor Role**
- Can create courses and assignments
- Can view and grade submissions
- Can override AI grades
- Permissions: `courses:create`, `assignments:manage`, `submissions:view`, `grades:write`, etc.

**Student Role**
- Can view enrolled courses
- Can submit assignments
- Can view grades and feedback
- Permissions: `courses:view`, `assignments:view`, `submissions:create`, `grades:view`

### Permission Naming Convention

Permissions follow a `resource:action` pattern:
- `courses:create`, `courses:read`, `courses:update`, `courses:delete`
- `assignments:create`, `assignments:manage`, `assignments:view`
- `submissions:view`, `submissions:create`, `submissions:grade`
- `grades:read`, `grades:write`, `grades:override`
- `users:read`, `users:manage`
- `plagiarism:view`, `plagiarism:investigate`
- `analytics:read`
- `audit_logs:read`

## OAuth2/SSO Integration

The module includes scaffolding for OAuth2 integration with:

### Okta Configuration

```typescript
// OAuth2 provider configuration
const oktaConfig = {
  authorizationURL: 'https://{domain}/oauth2/v1/authorize',
  tokenURL: 'https://{domain}/oauth2/v1/token',
  userProfileURL: 'https://{domain}/oauth2/v1/userinfo',
  clientID: process.env.OKTA_CLIENT_ID,
  clientSecret: process.env.OKTA_CLIENT_SECRET,
  callbackURL: process.env.OKTA_CALLBACK_URL,
};
```

### Azure AD Configuration

```typescript
const azureConfig = {
  authorizationURL: 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/authorize',
  tokenURL: 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token',
  userProfileURL: 'https://graph.microsoft.com/v1.0/me',
  clientID: process.env.AZURE_AD_CLIENT_ID,
  clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
  callbackURL: process.env.AZURE_AD_CALLBACK_URL,
};
```

### Integration Steps (Phase 2)

1. Implement `OktaStrategy` class extending `PassportStrategy`
2. Implement `AzureAdStrategy` class extending `PassportStrategy`
3. Handle user creation/linking in `UserService`
4. Map email domains or Azure groups to institutions
5. Test callback endpoints with provider configuration

## Security Best Practices

### 1. Secure Refresh Token Storage

- Stored in **HttpOnly** cookie (prevents XSS attacks)
- **Secure** flag (HTTPS only in production)
- **SameSite=Strict** (prevents CSRF)
- Automatically sent by browser on refresh endpoint calls

### 2. JWT Secret Management

- Store in environment variables (never in code)
- Minimum 32 characters
- Rotate periodically in production
- Use different secrets for access and refresh tokens

### 3. Token Expiration

- **Access tokens**: 1 hour (short-lived, limits damage if stolen)
- **Refresh tokens**: 30 days (reduces re-authentication frequency)
- Refresh endpoint issues new access token without user interaction

### 4. HTTPS in Production

- All authentication traffic must use TLS 1.2+
- Redirect HTTP to HTTPS
- Set security headers (HSTS, CSP, etc.)

### 5. Rate Limiting

- Implement rate limiting on `/auth/login` endpoint
- Detect brute-force attacks (multiple failed attempts)
- Lock account or add CAPTCHA challenge

### 6. Audit Logging

- Log all authentication events (login, token refresh, SSO)
- Log failed login attempts
- Never log passwords or sensitive data

## Testing

### Run All Tests
```bash
npm test
```

### Run Auth Tests Only
```bash
npm test -- auth
```

### Run Specific Test File
```bash
npm test -- jwt.service.spec.ts
```

### Test Coverage
```bash
npm run test:cov
```

## API Endpoints

### Authentication

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/auth/login` | Local login (email + password) | None |
| POST | `/auth/refresh` | Issue new access token | Refresh token |
| POST | `/auth/logout` | Logout (clear cookie) | JWT |
| GET | `/auth/me` | Get current user info | JWT |
| GET | `/auth/sso/okta/callback` | Okta OAuth2 callback | N/A |
| GET | `/auth/sso/azure/callback` | Azure AD OAuth2 callback | N/A |

## Troubleshooting

### "Invalid token" Error

**Cause**: Token signature invalid or secret mismatch
**Solution**: Verify `JWT_SECRET` in .env matches server

### "Token expired" Error

**Cause**: Access token expired (> 1 hour)
**Solution**: Call `/auth/refresh` to get new access token

### "Unauthorized" Error

**Cause**: No JWT provided or invalid format
**Solution**: Include `Authorization: Bearer <token>` header

### "Forbidden" Error

**Cause**: User lacks required role or permission
**Solution**: Verify user role and permissions

### "Invalid tenant" Error

**Cause**: User's tenant_id doesn't match request tenant
**Solution**: Verify user is member of that institution

## Next Steps

1. **Phase 2 - User Management**: Implement login endpoint with UserService
2. **Phase 2 - User Management**: Implement password hashing and validation
3. **Phase 2 - Deployment**: Configure OAuth2 providers with credentials
4. **Phase 3+**: Add rate limiting and brute-force detection
5. **Phase 3+**: Implement audit logging for all auth events

## References

- [NestJS Passport Integration](https://docs.nestjs.com/recipes/passport)
- [JWT RFC 7519](https://tools.ietf.org/html/rfc7519)
- [OAuth 2.0 Authorization Framework](https://tools.ietf.org/html/rfc6749)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
