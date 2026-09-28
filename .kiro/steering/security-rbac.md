# Security & RBAC Standards

## Role-Based Access Control (RBAC)

Three primary roles with hierarchical permissions:

### Role Definitions

**Admin Role**
- Manage institution settings (policies, users, billing)
- View all institution analytics
- Configure plagiarism thresholds
- Override any grade (with optional approval workflow)
- Access audit logs
- Manage other admins and instructors
- Permissions: institution:admin, users:manage, settings:write, udit_logs:read

**Instructor Role**
- Create and manage courses
- Create and publish assignments
- View student submissions
- Grade submissions manually or review AI grades
- Override AI-generated grades
- Configure assignment rubrics and settings
- Access course analytics
- Permissions: courses:create, ssignments:manage, submissions:view, grades:write

**Student Role**
- View enrolled courses
- Submit assignments (single or incremental)
- View grades and feedback
- Cannot override grades or manage courses
- Permissions: courses:view, ssignments:view, submissions:create, grades:view

### Custom Roles (Optional)

Admins can create custom roles with granular permissions:
- courses:create, courses:read, courses:update, courses:delete
- ssignments:create, ssignments:read, ssignments:update, ssignments:delete
- submissions:read, submissions:grade
- grades:read, grades:write, grades:override
- users:read, users:manage
- plagiarism:view, plagiarism:investigate
- nalytics:read
- udit_logs:read

---

## Authorization Patterns

### Decorator-Based RBAC

`	ypescript
// Guard decorator for role-based access
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.INSTRUCTOR, Role.ADMIN)
@Post('assignments')
async createAssignment(@Body() dto: CreateAssignmentDto) {
  // Only instructors and admins can create assignments
}

// Decorator for permission-based access
@UseGuards(AuthGuard, PermissionsGuard)
@Permissions('grades:write')
@Post('grades/:submissionId/override')
async overrideGrade(@Param('submissionId') submissionId: string) {
  // Only users with 'grades:write' permission
}
`

### Resource-Level Authorization

`	ypescript
// Check if user owns the resource or is admin
async canModifyAssignment(userId: string, assignmentId: string, tenantId: string): Promise<boolean> {
  const assignment = await this.assignmentRepository.findById(assignmentId, tenantId);
  if (!assignment) throw new NotFoundException('Assignment', assignmentId);
  
  const user = await this.userRepository.findById(userId, tenantId);
  if (user.role === Role.ADMIN) return true;
  
  return assignment.createdByUserId === userId; // Instructor created it
}
`

### Tenant Context

Every request must include tenant context:

`	ypescript
// Middleware to extract tenant from JWT or headers
export function TenantMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.headers['x-tenant-id'] || extractTenantFromJwt(req);
    if (!tenantId) throw new UnauthorizedException('Missing tenant context');
    
    res.locals.tenantId = tenantId;
    next();
  };
}

// All service methods receive tenantId
async getAssignment(assignmentId: string, tenantId: string): Promise<Assignment> {
  return this.db.query('SELECT * FROM assignments WHERE id =  AND tenant_id = ', 
    [assignmentId, tenantId]);
}
`

---

## Authentication

### JWT Claims

`json
{
  "sub": "user-id-uuid",
  "email": "instructor@university.edu",
  "tenant_id": "institution-uuid",
  "role": "instructor",
  "permissions": ["courses:create", "assignments:manage"],
  "iat": 1234567890,
  "exp": 1234571490
}
`

### Token Lifecycle

- **Access Token**: 1 hour expiration
- **Refresh Token**: 30 days expiration (stored in secure cookie)
- **SSO Integration**: Support OAuth2 for institutional identity providers (Okta, Azure AD, etc.)

---

## Data Security

### Encryption

- **At Rest**: AES-256 encryption for sensitive fields (student data, submission content)
  `	ypescript
  const encrypted = await encryptField(submissionContent, encryptionKey);
  `
  
- **In Transit**: TLS 1.2+ for all API traffic
  `	ypescript
  // NestJS configuration
  const httpsOptions = {
    key: fs.readFileSync(process.env.TLS_KEY_PATH),
    cert: fs.readFileSync(process.env.TLS_CERT_PATH),
  };
  `

### PII Handling

- Student names, emails, IDs are encrypted at rest
- Avoid storing PII in logs or error messages
- Support data export and deletion (GDPR compliance)
- Implement data anonymization for testing/development

### Audit Logging

All sensitive actions are logged:
- User authentication (login/logout)
- Grade creation, modification, override
- Plagiarism flags
- Administrative actions (user management, policy changes)
- Data access (for compliance audits)

`	ypescript
async logAuditEvent(tenantId: string, event: {
  eventType: string;
  actorUserId: string;
  resourceType: string;
  resourceId: string;
  actionDetails: Record<string, any>;
  ipAddress: string;
}): Promise<void> {
  await this.auditLogRepository.create({
    ...event,
    tenant_id: tenantId,
    created_at: new Date(),
  });
}
`

---

## FERPA & GDPR Compliance

### FERPA (Family Educational Rights and Privacy Act)

- Student records are accessible only to: the student themselves, instructors in the course, institutional admins
- Grade records must remain linked to the student for institutional purposes
- Implement course-scoped visibility: students see only their own records
- Cross-institutional access is denied

### GDPR (General Data Protection Regulation)

- Right to data export: Users can request their data in machine-readable format (CSV/JSON)
- Right to deletion: Users can request account deletion with full PII removal
- Data retention: Grades are retained per institutional policy; personal identifiers are purged after 90 days of account deletion
- Consent tracking: Log when users consent to data processing

---

## OWASP Compliance

### Prevention Measures

1. **SQL Injection**
   - Use parameterized queries (NestJS TypeORM/Prisma handles this)
   - Never concatenate user input into SQL strings

2. **Cross-Site Scripting (XSS)**
   - Sanitize all user input in Next.js (built-in with React)
   - Use Content Security Policy headers
   `	ypescript
   app.use(helmet()); // Sets security headers including CSP
   `

3. **Cross-Site Request Forgery (CSRF)**
   - Include CSRF tokens in all state-changing requests
   - Use SameSite cookie attribute

4. **Authentication & Session Management**
   - Use JWT with secure expiration
   - Implement logout by invalidating refresh tokens
   - Support SSO with secure token validation

5. **Authorization**
   - All endpoints enforce RBAC (see patterns above)
   - Check tenant_id on every query

6. **Input Validation**
   - Validate all request DTOs with class-validator
   `	ypescript
   class CreateAssignmentDto {
     @IsString()
     @IsNotEmpty()
     @MaxLength(255)
     title: string;
     
     @IsEnum(AssignmentType)
     assignmentType: AssignmentType;
   }
   `

7. **Error Handling**
   - Don't expose stack traces or internal details in API responses
   - Log errors securely for debugging
   - Return generic error messages to clients

8. **Dependency Security**
   - Keep all npm dependencies up to date
   - Run 
pm audit in CI/CD pipeline
   - Use lock files (package-lock.json)

---

## Rate Limiting

Implement rate limiting on API endpoints:

`	ypescript
@UseGuards(ThrottleGuard)
@Throttle(10, 60) // 10 requests per 60 seconds
@Post('grades')
async createGrade() { }
`

---

## Secrets Management

Store sensitive configuration in environment variables:
- Database credentials
- AI API keys (OpenAI, Anthropic, Bedrock)
- Encryption keys
- JWT secret

Use AWS Secrets Manager or HashiCorp Vault in production.

