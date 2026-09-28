# Task 1.10: Setup Error Handling & Exception Filters - Deliverables

## Overview

This task establishes a comprehensive error handling system for the NestJS application with a custom exception hierarchy, global exception filter, and standardized error response format. The implementation ensures security by never exposing internal details (stack traces, file paths, SQL, API keys) to clients.

## Deliverables Completed

### 1. Custom Exception Base Class
**File**: `src/common/exceptions/app.exception.ts`

Base exception class that all application exceptions extend:
- Properties: `code` (string), `message` (string), `statusCode` (number), `details` (any)
- Methods: `getResponse()` - returns standardized response object
- Methods: `getStatus()` - returns HTTP status code
- Never exposes stack traces or internal details in responses

### 2. Specific Exception Subclasses

#### ValidationException
**File**: `src/common/exceptions/validation.exception.ts`
- **HTTP Status**: 400
- **Code**: VALIDATION_ERROR
- **Details**: Array of validation error objects with field and issue properties
- **Use Case**: Request validation failures, missing fields, invalid formats

#### NotFoundException
**File**: `src/common/exceptions/not-found.exception.ts`
- **HTTP Status**: 404
- **Code**: NOT_FOUND
- **Details**: Resource type and optionally resource ID
- **Use Case**: Resource not found (user, course, assignment, etc.)

#### UnauthorizedException
**File**: `src/common/exceptions/unauthorized.exception.ts`
- **HTTP Status**: 401
- **Code**: UNAUTHORIZED
- **Details**: Reason (missing token, invalid token, expired token, etc.)
- **Use Case**: Missing or invalid authentication credentials

#### ForbiddenException
**File**: `src/common/exceptions/forbidden.exception.ts`
- **HTTP Status**: 403
- **Code**: FORBIDDEN
- **Details**: Reason (permission denied, insufficient role, etc.)
- **Use Case**: User lacks permission for operation

#### ConflictException
**File**: `src/common/exceptions/conflict.exception.ts`
- **HTTP Status**: 409
- **Code**: CONFLICT
- **Details**: Conflict details (duplicate key, version conflict, etc.)
- **Use Case**: Resource conflict with current state

#### InternalServerException
**File**: `src/common/exceptions/internal-server.exception.ts`
- **HTTP Status**: 500
- **Code**: INTERNAL_SERVER_ERROR
- **Details**: None (NEVER expose internal details)
- **Use Case**: Unexpected server errors
- **Important**: Never includes details to prevent information leakage

#### TimeoutException
**File**: `src/common/exceptions/timeout.exception.ts`
- **HTTP Status**: 504
- **Code**: TIMEOUT
- **Details**: Operation name that timed out
- **Use Case**: Operation exceeded timeout (grading, plagiarism scan, etc.)

#### BadRequestException
**File**: `src/common/exceptions/bad-request.exception.ts`
- **HTTP Status**: 400
- **Code**: BAD_REQUEST
- **Details**: What was wrong with the request
- **Use Case**: Malformed request body, invalid JSON, etc.

#### RateLimitException
**File**: `src/common/exceptions/rate-limit.exception.ts`
- **HTTP Status**: 429
- **Code**: RATE_LIMIT_EXCEEDED
- **Details**: retryAfter (seconds until retry allowed)
- **Use Case**: Rate limit exceeded

### 3. Global Exception Filter
**File**: `src/common/filters/global-exception.filter.ts`

Catches all exceptions and transforms them to standardized format:
- Implements NestJS `ExceptionFilter` interface
- Intercepts all exceptions (custom AppException and built-in NestJS exceptions)
- Transforms to standardized JSON response format
- Logs exceptions with appropriate level based on HTTP status:
  - 5xx errors logged as ERROR with stack trace
  - 4xx errors logged as WARN
  - 2xx/3xx logged as DEBUG
- Never exposes stack traces to clients
- Handles built-in NestJS HttpException
- Maps HTTP status codes to error codes
- Extracts user context from request (user_id, tenant_id) for logging
- Includes request metadata in response (path, timestamp)

### 4. Exception Exports
**File**: `src/common/exceptions/index.ts`

Central export location for all custom exceptions:
```typescript
export { AppException } from './app.exception';
export { ValidationException } from './validation.exception';
export { NotFoundException } from './not-found.exception';
export { UnauthorizedException } from './unauthorized.exception';
export { ForbiddenException } from './forbidden.exception';
export { ConflictException } from './conflict.exception';
export { InternalServerException } from './internal-server.exception';
export { TimeoutException } from './timeout.exception';
export { BadRequestException } from './bad-request.exception';
export { RateLimitException } from './rate-limit.exception';
```

### 5. Filters Exports
**File**: `src/common/filters/index.ts`

Central export location for all filters:
```typescript
export { GlobalExceptionFilter } from './global-exception.filter';
```

### 6. Common Module Index
**File**: `src/common/index.ts`

Re-exports exceptions and filters for convenient importing:
```typescript
export * from './exceptions';
export * from './filters';
export * from './decorators';
```

## Response Format

All error responses follow this standardized format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "optional": "error details"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/v1/users"
}
```

### Response Examples

**Validation Error (400)**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "issue": "Invalid email format" },
      { "field": "password", "issue": "Password must be at least 8 characters" }
    ]
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/v1/users"
}
```

**Not Found Error (404)**:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Course not found",
    "details": {
      "resourceType": "Course",
      "resourceId": "course-123"
    }
  },
  "timestamp": "2024-01-15T10:30:01.000Z",
  "path": "/api/v1/courses/course-123"
}
```

**Internal Server Error (500)**:
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An internal server error occurred"
  },
  "timestamp": "2024-01-15T10:30:02.000Z",
  "path": "/api/v1/assignments"
}
```

## Unit Tests

Comprehensive unit tests have been created for all exceptions and the global filter:

### Exception Tests
- `src/common/exceptions/app.exception.spec.ts` - Base exception functionality
- `src/common/exceptions/validation.exception.spec.ts` - Validation error handling
- `src/common/exceptions/not-found.exception.spec.ts` - Not found error handling
- `src/common/exceptions/unauthorized.exception.spec.ts` - Auth error handling
- `src/common/exceptions/forbidden.exception.spec.ts` - Permission error handling
- `src/common/exceptions/conflict.exception.spec.ts` - Conflict error handling
- `src/common/exceptions/internal-server.exception.spec.ts` - Server error handling
- `src/common/exceptions/timeout.exception.spec.ts` - Timeout error handling
- `src/common/exceptions/bad-request.exception.spec.ts` - Bad request handling
- `src/common/exceptions/rate-limit.exception.spec.ts` - Rate limit handling

### Filter Tests
- `src/common/filters/global-exception.filter.spec.ts` - Filter behavior verification

**Test Coverage**:
- All exception types instantiation
- Response format correctness
- Status code mapping
- Error code assignment
- Details handling
- Instanceof checks for subclassing
- Throwability and catchability
- NestJS HttpException handling
- Generic Error handling
- Unknown exception handling
- Stack trace prevention
- Context extraction for logging
- Metadata inclusion in responses

## Acceptance Criteria Verification

✅ **Custom exceptions extend AppException**
- All specific exceptions (ValidationException, NotFoundException, etc.) extend AppException base class
- Proper prototype chain maintained for instanceof checks
- Stack traces captured for all exceptions

✅ **Global filter returns standardized JSON**
- All responses follow the standard format with success=false, error object, timestamp, path
- JSON serializable without stack traces

✅ **Error response includes required fields**
- All responses include: success, error.code, error.message, error.details (when applicable)
- Timestamp in ISO 8601 format
- Request path included

✅ **Stack traces never exposed to clients**
- Filter explicitly excludes stack traces from response JSON
- Error logs contain stack traces for debugging (server-side only)
- No internal error objects serialized to response

✅ **No internal details in responses**
- File paths never included
- SQL queries never included
- API keys never included
- Database errors sanitized
- Exception messages sanitized for client safety
- Internal server errors provide generic message only

## Integration Points

To integrate this error handling system into the NestJS application:

### 1. Register Global Filter in Main.ts

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Register global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());
  
  await app.listen(3000);
}
bootstrap();
```

### 2. Register in AppModule (Alternative)

```typescript
import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

@Global()
@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class ExceptionModule {}
```

### 3. Usage in Services/Controllers

```typescript
import { Injectable } from '@nestjs/common';
import { ValidationException, NotFoundException } from './common/exceptions';

@Injectable()
export class UsersService {
  createUser(email: string, name: string) {
    // Validation errors
    if (!email.includes('@')) {
      throw new ValidationException('Invalid input', [
        { field: 'email', issue: 'Invalid email format' }
      ]);
    }
    
    // Not found errors
    const user = this.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User', email);
    }
  }
}
```

## Error Logging

The global exception filter logs exceptions with:
- **Log Level**: Based on HTTP status
  - 5xx → ERROR
  - 4xx → WARN
  - 2xx/3xx → DEBUG
- **Log Context**:
  - path: Request path
  - method: HTTP method
  - statusCode: HTTP status code
  - code: Error code
  - message: Error message
  - userId: Current user ID (if available)
  - tenantId: Current tenant ID (if available)
  - ip: Client IP address

## Security Considerations

1. **No Stack Traces to Clients**: Stack traces are only logged server-side, never sent to clients
2. **No Internal Details**: File paths, SQL queries, API keys never exposed
3. **Generic Error Messages**: For 500 errors, use generic "An internal server error occurred"
4. **Sanitized Details**: Error details filtered to prevent information leakage
5. **Context Included for Debugging**: Logs include user/tenant context for debugging
6. **Audit Trail**: All errors logged with timestamp and context for compliance

## Next Steps

1. Create `src/app.module.ts` and register the global exception filter
2. Create `src/main.ts` and configure NestJS application
3. Test exception handling in Controllers and Services
4. Integrate with RBAC guards and middleware (Tasks 1.8, 1.7)
5. Extend with custom error codes as needed for specific domains

## Files Created

### Exception Classes
- `src/common/exceptions/app.exception.ts` (134 lines)
- `src/common/exceptions/validation.exception.ts` (32 lines)
- `src/common/exceptions/not-found.exception.ts` (36 lines)
- `src/common/exceptions/unauthorized.exception.ts` (32 lines)
- `src/common/exceptions/forbidden.exception.ts` (30 lines)
- `src/common/exceptions/conflict.exception.ts` (30 lines)
- `src/common/exceptions/internal-server.exception.ts` (33 lines)
- `src/common/exceptions/timeout.exception.ts` (38 lines)
- `src/common/exceptions/bad-request.exception.ts` (31 lines)
- `src/common/exceptions/rate-limit.exception.ts` (34 lines)

### Filters
- `src/common/filters/global-exception.filter.ts` (180 lines)

### Exports
- `src/common/exceptions/index.ts` (13 lines)
- `src/common/filters/index.ts` (5 lines)
- `src/common/index.ts` (16 lines)

### Unit Tests
- `src/common/exceptions/app.exception.spec.ts` (109 lines)
- `src/common/exceptions/validation.exception.spec.ts` (92 lines)
- `src/common/exceptions/not-found.exception.spec.ts` (110 lines)
- `src/common/exceptions/unauthorized.exception.spec.ts` (86 lines)
- `src/common/exceptions/forbidden.exception.spec.ts` (84 lines)
- `src/common/exceptions/conflict.exception.spec.ts` (99 lines)
- `src/common/exceptions/internal-server.exception.spec.ts` (79 lines)
- `src/common/exceptions/timeout.exception.spec.ts` (84 lines)
- `src/common/exceptions/bad-request.exception.spec.ts` (83 lines)
- `src/common/exceptions/rate-limit.exception.spec.ts` (85 lines)
- `src/common/filters/global-exception.filter.spec.ts` (292 lines)

**Total**: 22 files, ~1,800 lines of production code and tests

## Verification Checklist

- ✅ All exceptions compile with no errors
- ✅ Global filter catches and transforms all exceptions
- ✅ Response format consistent across all error types
- ✅ No stack traces in responses
- ✅ No internal details exposed to clients
- ✅ Helpful error messages for debugging (server-side)
- ✅ Unit tests verify all functionality
- ✅ Exception hierarchy properly implemented
- ✅ HTTP status codes correctly mapped
- ✅ Error codes standardized
- ✅ Logging context includes user and tenant information
- ✅ Security best practices enforced (no sensitive data exposure)
