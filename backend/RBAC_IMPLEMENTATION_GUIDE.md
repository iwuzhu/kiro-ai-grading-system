# RBAC (Role-Based Access Control) Implementation Guide

## Overview

This guide documents the RBAC system implemented in Task 1.8, which provides comprehensive role-based and permission-based access control for the AI Grading System.

## Architecture

### Three-Layer Authorization Model

```
Layer 1: Authentication (JWT Guard)
   ↓
Layer 2: Tenant Isolation (Tenant Guard)
   ↓
Layer 3: RBAC (Roles Guard + Permissions Guard)
   ↓
Layer 4: Resource Ownership (Resource Owner Guard)
   ↓
Business Logic
```

### Role Hierarchy

```
ADMIN (highest privilege)
  ├─ Can manage institutions
  ├─ Can manage all users
  ├─ Can access all resources
  └─ Can override any permission

INSTRUCTOR (mid privilege)
  ├─ Can create and manage courses
  ├─ Can manage students in courses
  ├─ Can grade submissions
  └─ Can configure assignments

STUDENT (lowest privilege)
  ├─ Can view enrolled courses
  ├─ Can submit assignments
  ├─ Can view own grades
  └─ Read-only access (mostly)
```

## Files and Structure

### Enums

- `src/domain/enums/user-role.enum.ts` - User role definitions and utilities
- `src/domain/enums/permission.enum.ts` - Fine-grained permission definitions

### Decorators

- `src/common/decorators/roles.decorator.ts` - @Roles() for role-based access
- `src/common/decorators/permissions.decorator.ts` - @Permissions() for permission-based access
- `src/common/decorators/require-ownership.decorator.ts` - @RequireOwnership() for resource ownership
- `src/common/decorators/public-endpoint.decorator.ts` - @PublicEndpoint() for unauthenticated routes

### Guards

- `src/common/guards/roles.guard.ts` - Enforces @Roles() decorator
- `src/common/guards/permissions.guard.ts` - Enforces @Permissions() decorator
- `src/common/guards/tenant.guard.ts` - Validates tenant context
- `src/common/guards/resource-owner.guard.ts` - Enforces resource ownership

### Tests

- `*.spec.ts` files for each guard and decorator
- Comprehensive unit tests covering all scenarios
- 150+ test cases validating RBAC behavior

## Role Definitions

### Admin Role

**Permissions:**
- All user management (create, read, update, delete, bulk import, export)
- All institution settings
- All course operations
- All assignment operations
- All submission operations
- All grading operations
- All plagiarism operations

**Characteristics:**
- Can override any permission
- Can access all data in their institution
- No resource ownership restrictions

### Instructor Role

**Permissions:**
- Read users
- Read institution info
- Create/manage courses (within institution)
- Create/manage assignments
- Read submissions
- Write/override grades
- Read plagiarism data
- Investigate plagiarism

**Characteristics:**
- Can only manage their own courses
- Can only grade submissions in their courses
- Cannot manage other instructors' courses
- Cannot manage institutions

### Student Role

**Permissions:**
- Read courses (only enrolled)
- Read assignments (in enrolled courses)
- Create submissions (for assignments)
- Resubmit assignments
- View own grades
- View own submissions
- Read plagiarism flags (own submissions)

**Characteristics:**
- Read-only access (mostly)
- Can only see their own data
- Cannot modify anything except submissions
- Cannot access other students' data

## Permission Definitions

Permissions follow the format: `resource:action`

### User Management
- `users:create` - Create new users
- `users:read` - View users
- `users:update` - Update user info
- `users:delete` - Delete users
- `users:bulk_import` - Bulk import users (admin only)
- `users:export` - Export user data

### Institution Management
- `institutions:read` - View institution
- `institutions:update` - Update institution settings
- `institutions:delete` - Delete institution
- `institutions:settings:manage` - Manage institution settings (admin only)

### Course Management
- `courses:create` - Create courses
- `courses:read` - View courses
- `courses:update` - Update courses
- `courses:delete` - Delete courses
- `courses:archive` - Archive courses
- `courses:view_analytics` - View course analytics
- `courses:publish` - Publish courses

### Assignment Management
- `assignments:create` - Create assignments
- `assignments:read` - View assignments
- `assignments:update` - Update assignments
- `assignments:delete` - Delete assignments
- `assignments:publish` - Publish assignments
- `assignments:configure_rubric` - Configure grading rubric

### Submission Management
- `submissions:read` - View all submissions
- `submissions:view_own` - View own submissions (students)
- `submissions:download` - Download submissions
- `submissions:create` - Create submissions
- `submissions:resubmit` - Resubmit assignments

### Grade Management
- `grades:read` - View all grades
- `grades:view_own` - View own grades (students)
- `grades:view_analytics` - View grade analytics
- `grades:write` - Create/update grades
- `grades:override` - Override AI grades
- `grades:release` - Release grades to students

### Plagiarism/Integrity Management
- `plagiarism:read` - View plagiarism reports
- `plagiarism:investigate` - Investigate plagiarism
- `plagiarism:flag` - Flag submissions for plagiarism
- `plagiarism:settings:manage` - Manage plagiarism settings (admin only)

## Usage Examples

### Basic Role-Based Access

```typescript
@Controller('/api/v1/admin')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class AdminController {
  @Get('/dashboard')
  @Roles(UserRole.ADMIN)
  getDashboard() {
    // Only admins can access
  }

  @Get('/users')
  @Roles(UserRole.ADMIN)
  getUsers() {
    // Only admins can access
  }
}
```

### Multiple Roles

```typescript
@Controller('/api/v1/courses')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class CoursesController {
  @Get()
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR, UserRole.STUDENT)
  getCourses() {
    // Admin, instructor, or student can access
  }
}
```

### Permission-Based Access

```typescript
@Controller('/api/v1/grades')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GradesController {
  @Post(':id/override')
  @Permissions(Permission.GRADES_OVERRIDE)
  overrideGrade(@Param('id') gradeId: string) {
    // Only users with grades:override permission
  }

  @Delete(':id')
  @Permissions(Permission.GRADES_WRITE, Permission.GRADES_OVERRIDE)
  deleteGrade(@Param('id') gradeId: string) {
    // User must have BOTH permissions
  }
}
```

### Resource Ownership

```typescript
@Controller('/api/v1/assignments')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, ResourceOwnerGuard)
export class AssignmentsController {
  @Patch(':id')
  @Roles(UserRole.INSTRUCTOR)
  @RequireOwnership('id')
  updateAssignment(
    @Param('id') assignmentId: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    // Instructor must own the assignment
  }

  @Delete(':id')
  @Roles(UserRole.INSTRUCTOR)
  @RequireOwnership('id')
  deleteAssignment(@Param('id') assignmentId: string) {
    // Instructor must own the assignment
    // Admins bypass ownership check
  }
}
```

### Public Endpoints

```typescript
@Controller('/api/v1/auth')
export class AuthController {
  @Post('/login')
  @PublicEndpoint()
  login(@Body() dto: LoginDto) {
    // No authentication required
  }

  @Post('/register')
  @PublicEndpoint()
  register(@Body() dto: RegisterDto) {
    // No authentication required
  }
}
```

### Composite Guard Stack

```typescript
@Controller('/api/v1/submissions')
@UseGuards(
  JwtAuthGuard,        // 1. Validate JWT token
  TenantGuard,         // 2. Validate tenant isolation
  RolesGuard,          // 3. Check role (coarse-grained)
  PermissionsGuard,    // 4. Check permissions (fine-grained)
  ResourceOwnerGuard   // 5. Check resource ownership
)
export class SubmissionsController {
  @Post()
  @Roles(UserRole.STUDENT)
  @Permissions(Permission.SUBMISSIONS_CREATE)
  @RequireOwnership('assignmentId')
  submitAssignment(
    @Body() dto: SubmitAssignmentDto,
  ) {
    // Must be student, have submission permission, own the assignment
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR, UserRole.STUDENT)
  @Permissions(Permission.SUBMISSIONS_READ, Permission.SUBMISSIONS_VIEW_OWN)
  getSubmission(@Param('id') submissionId: string) {
    // Role check: all roles can access
    // Permission check: only those with read permissions
  }
}
```

## Guard Execution Order

Guards execute in the order they are declared:

```typescript
@UseGuards(
  JwtAuthGuard,        // Runs 1st: Validates JWT
  TenantGuard,         // Runs 2nd: Validates tenant
  RolesGuard,          // Runs 3rd: Checks @Roles
  PermissionsGuard,    // Runs 4th: Checks @Permissions
  ResourceOwnerGuard   // Runs 5th: Checks @RequireOwnership
)
```

**Important:** Each guard must pass for the next one to run. If any guard fails, the request is rejected immediately.

## Error Responses

### 401 Unauthorized

Returned when:
- JWT token is missing or invalid
- User role is missing or invalid
- Tenant context is missing
- User doesn't belong to the requested tenant

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "User role not found in request",
    "details": {
      "reason": "Missing user context - ensure JWT authentication guard is applied"
    }
  }
}
```

### 403 Forbidden

Returned when:
- User's role doesn't match @Roles
- User lacks required @Permissions
- User doesn't own the resource
- User doesn't belong to the requested tenant

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "User role 'student' does not have access to this resource",
    "details": {
      "reason": "Required roles: admin, instructor"
    }
  }
}
```

## Implementation Checklist

### ✅ Task 1.8 Deliverables

- [x] RolesGuard - Checks user role against @Roles decorator
- [x] PermissionsGuard - Checks user permissions
- [x] TenantGuard - Validates tenant context
- [x] ResourceOwnerGuard - Verifies resource ownership
- [x] @Roles() decorator - Specify required roles
- [x] @Permissions() decorator - Specify required permissions
- [x] @RequireOwnership() decorator - Require resource ownership
- [x] @PublicEndpoint() decorator - Skip authentication
- [x] UserRole enum - Define roles (ADMIN, INSTRUCTOR, STUDENT)
- [x] Permission enum - Define all permissions
- [x] Comprehensive unit tests (150+ cases)

### Testing Coverage

All guards and decorators have comprehensive unit tests:

```bash
# Run all RBAC tests
npm test -- roles.guard.spec.ts
npm test -- permissions.guard.spec.ts
npm test -- tenant.guard.spec.ts
npm test -- resource-owner.guard.spec.ts
npm test -- user-role.enum.spec.ts
npm test -- permission.enum.spec.ts
npm test -- roles.decorator.spec.ts

# Run all tests
npm test
```

## Best Practices

### 1. Use Guards at Controller Level

```typescript
// Good: Protects all endpoints in controller
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('/api/v1/admin')
export class AdminController { }

// Also acceptable: Use on individual methods
@Post()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
createUser() { }
```

### 2. Stack Guards for Layered Security

```typescript
// Recommended: Layer multiple checks
@UseGuards(
  JwtAuthGuard,      // Authentication
  TenantGuard,       // Tenant isolation
  RolesGuard,        // Role check
  PermissionsGuard   // Permission check
)

// Not recommended: Skip layers
@UseGuards(JwtAuthGuard)  // Missing tenant/role checks
```

### 3. Use Specific Permissions

```typescript
// Good: Specific permission
@Permissions(Permission.GRADES_OVERRIDE)
overrideGrade() { }

// Less good: Broad permission
@Permissions(Permission.GRADES_WRITE)  // Could be too permissive
```

### 4. Document Required Permissions

```typescript
/**
 * Override an AI-generated grade
 * 
 * Required role: INSTRUCTOR or ADMIN
 * Required permission: grades:override
 * Required ownership: User must own the course containing the submission
 */
@Patch(':id/override')
@Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
@Permissions(Permission.GRADES_OVERRIDE)
@RequireOwnership('courseId')
overrideGrade(
  @Param('id') gradeId: string,
  @Body() dto: OverrideGradeDto,
) { }
```

### 5. Validate User Context

Always validate that request has required user context:

```typescript
// In services/middleware
if (!request.user?.id) {
  throw new UnauthorizedException('User ID missing');
}

if (!request.user?.role) {
  throw new UnauthorizedException('User role missing');
}

if (!request.user?.tenantId) {
  throw new UnauthorizedException('Tenant ID missing');
}
```

## Integration with Database

The RBAC system integrates with database Row-Level Security (RLS):

```typescript
// RLS policy enforces tenant isolation
SELECT * FROM assignments
WHERE tenant_id = grading.get_current_tenant_id()

// Guard enforces role/permission checks
if (!roleHasPermission(userRole, permission)) {
  throw new ForbiddenException();
}

// Both layers combine for complete protection
```

## Future Enhancements

### Custom Roles (Phase 2)

```typescript
// Allow institutions to define custom roles
const customRole = await roleService.create({
  tenantId: 'institution-123',
  name: 'Department Chair',
  permissions: [
    Permission.COURSES_VIEW_ANALYTICS,
    Permission.GRADES_VIEW_ANALYTICS,
  ],
});
```

### Dynamic Permissions (Phase 2)

```typescript
// Load permissions from database
const permissions = await permissionService.getForUser(userId);

// Custom guard checks dynamic permissions
@UseGuards(DynamicPermissionsGuard)
```

### Audit Trail (Phase 3)

```typescript
// Log all access control decisions
await auditService.logAccessControl({
  userId,
  tenantId,
  resource: 'assignments',
  action: 'read',
  result: 'allowed', // or 'denied'
  reason: 'user has ASSIGNMENTS_READ permission',
});
```

## Troubleshooting

### Issue: "User role not found in request"

**Cause:** JWT authentication guard didn't run or didn't set req.user.role

**Solution:** Ensure JwtAuthGuard runs before RolesGuard:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)  // Correct order
@UseGuards(RolesGuard, JwtAuthGuard)  // Wrong order
```

### Issue: "User does not belong to the requested tenant"

**Cause:** User's tenant_id doesn't match request tenant

**Solution:** Verify JWT contains correct tenant_id claim:

```typescript
// JWT payload must include
{
  sub: 'user-uuid',
  tenant_id: 'institution-uuid',
  role: 'instructor'
}
```

### Issue: "Missing permission: grades:override"

**Cause:** User's role doesn't have this permission

**Solution:** Check ROLE_PERMISSIONS mapping:

```typescript
// Verify role has permission
roleHasPermission('instructor', Permission.GRADES_OVERRIDE)  // true
roleHasPermission('student', Permission.GRADES_OVERRIDE)     // false
```

## Security Considerations

### 1. Defense in Depth

```
Client Request
    ↓
Signature Verification (JWT)
    ↓
Expiration Check (JWT)
    ↓
Tenant Validation (TenantGuard)
    ↓
Role Check (RolesGuard)
    ↓
Permission Check (PermissionsGuard)
    ↓
Ownership Check (ResourceOwnerGuard)
    ↓
RLS Policy (Database)
    ↓
Response
```

### 2. No Client-Side Trust

Guards validate on every request:
- Never trust role from client
- Always validate on server
- Database RLS provides final layer

### 3. Tenant Isolation

Every query scoped to current tenant:
- RLS policies filter at database level
- Guards prevent cross-tenant access
- Middleware sets tenant context

## References

- NestJS Guards: https://docs.nestjs.com/guards
- NestJS Decorators: https://docs.nestjs.com/custom-decorators
- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- RBAC Design: https://en.wikipedia.org/wiki/Role-based_access_control

## Support

For questions or issues:
1. Check this guide
2. Review test cases for usage examples
3. Check guard/decorator implementations
4. Consult security-rbac.md steering document
