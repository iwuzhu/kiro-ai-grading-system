# AI Grading System - Technical Design Document

## Overview

The AI Grading System is a multi-tenant, cloud-based educational assessment platform designed to streamline grading workflows, detect academic integrity issues, and provide actionable feedback to students. This design document specifies the technical architecture, data models, component interactions, and operational patterns that implement the business requirements.

### Design Approach

This system employs a **layered, tenant-aware architecture** that separates concerns across presentation (Next.js frontend), application logic (NestJS API), persistence (PostgreSQL with row-level security), and external integrations (AI providers, plagiarism services). Each layer enforces tenant isolation and authorization controls independently, creating defense-in-depth security.

The design prioritizes **operational resilience** with fallback strategies for external service failures, **observability** through immutable audit trails and structured logging, and **compliance** with FERPA and GDPR regulations. Multi-tenancy is implemented at the database level using PostgreSQL row-level security policies combined with application-level tenant context verification.

### Design Principles

- **Multi-Tenancy First**: All data and operations are scoped to tenants with complete logical isolation
- **Clean Architecture**: Separation of concerns across domain, application, and infrastructure layers
- **RBAC Enforcement**: Authorization checks at every layer (decorator, service, repository)
- **Fail-Safe Defaults**: Errors default to secure, conservative behavior
- **Composable AI**: Pluggable AI providers with consistent interfaces
- **Observability**: Comprehensive audit trails, structured logging, and monitoring hooks
- **Testability**: Pure functions and mockable external dependencies
- **Resilience**: Graceful degradation when external services are unavailable

---

## Architecture

The system architecture follows a layered design with clear separation of concerns across client, API, data persistence, and external integrations. This section describes the high-level architecture and component organization.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────┤
│  Next.js Frontend (React 18)                                │
│  - Institution Dashboard                                    │
│  - Instructor Gradebook & Assignment Management             │
│  - Student Submission & Feedback Portal                     │
│  - Real-time Notifications (WebSocket)                      │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS / TLS 1.2+
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    API LAYER (NestJS)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Authentication & Tenant Middleware                      ││
│  │  - JWT validation                                       ││
│  │  - Tenant context extraction                            ││
│  │  - RBAC guard enforcement                               ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────┬──────────────┬──────────────┐             │
│  │ Assignments  │ Submissions  │ Grading      │  REST       │
│  │ Controllers  │ Controllers  │ Controllers  │  Endpoints  │
│  └──────────────┴──────────────┴──────────────┘             │
│                                                              │
│  ┌──────────────┬──────────────┬──────────────┐             │
│  │ Plagiarism   │ Analytics    │ Users        │             │
│  │ Controllers  │ Controllers  │ Controllers  │             │
│  └──────────────┴──────────────┴──────────────┘             │
└─────────┬────────────────────┬────────────────────┬─────────┘
          │                    │                    │
          ▼                    ▼                    ▼
    ┌──────────────┐    ┌────────────────┐  ┌─────────────┐
    │ PostgreSQL   │    │ Redis Cache    │  │ External    │
    │ (Tenant Data)│    │ (Session/Grade)   │ Services    │
    └──────────────┘    └────────────────┘  └─────────────┘
                                                   │
                        ┌──────────────┬──────────┴──────────┐
                        ▼              ▼                     ▼
                    ┌─────────┐   ┌──────────┐   ┌─────────────────┐
                    │ OpenAI  │   │ Claude   │   │ Amazon Bedrock  │
                    │ (GPT-4) │   │ (Opus)   │   │ (Titan/Claude)  │
                    └─────────┘   └──────────┘   └─────────────────┘
                        │
                        ▼
                    ┌──────────────┐
                    │ Turnitin API │
                    │ (Plagiarism) │
                    └──────────────┘
```

### Architecture Layers

| Layer | Technology | Responsibility |
|-------|-----------|-----------------|
| **Presentation** | Next.js + React 18 | UI, state management, real-time updates, client validation |
| **API Gateway** | NestJS + Express | Request routing, middleware, authentication, rate limiting |
| **Application Logic** | NestJS Services | Business logic orchestration, workflow coordination |
| **Data Access** | TypeORM Repositories | Query abstraction, tenant filtering, transaction management |
| **Persistence** | PostgreSQL with RLS | Data storage, ACID compliance, audit trail maintenance |
| **Cache Layer** | Redis | Session management, grade caching, notification queues |
| **External Services** | AI APIs & Turnitin | Grading, feedback generation, plagiarism detection |

### Multi-Tenancy & Isolation

#### Tenant Context Flow

Every request follows this tenant isolation pattern:

```
HTTP Request
  ↓
[Extract tenant_id from JWT claim or X-Tenant-ID header]
  ↓
[Validate JWT and extract user info]
  ↓
[Set app.current_tenant_id in request context]
  ↓
[Load user role and permissions from Redis cache]
  ↓
[Execute RBAC guard checks]
  ↓
[Set PostgreSQL session variable: SET app.current_tenant_id = 'uuid']
  ↓
[All database queries filtered by RLS policies]
  ↓
[Return response (contains tenant_id in JSON)]
```

#### Database-Level Isolation

All tables enforce tenant isolation through:

1. **Foreign Key Constraint**: `tenant_id` is part of primary key or unique constraint
2. **Row-Level Security Policy**:
   ```sql
   CREATE POLICY tenant_isolation ON assignments
     USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
   ```
3. **Application-Level Enforcement**: Every repository query explicitly filters by `tenant_id`

#### Tenant Provisioning

When an institution is created:

```
Administrator creates institution
  ↓
[Validate institution details]
  ↓
[Create institution record with tenant_id]
  ↓
[Create default admin user for institution]
  ↓
[Provision isolated schema objects (policies, indices)]
  ↓
[Initialize institution configuration (plagiarism thresholds, grade scale)]
  ↓
[Return tenant_id and provisioning confirmation]
  ↓
[If any step fails, ROLLBACK entire transaction]
```

---

## Components and Interfaces

This section describes the major system components and their interfaces with one another.

### 3.1 Frontend Component (Next.js)

**Responsibilities:**
- Render institution dashboards for administrators
- Render instructor gradebooks and assignment management UI
- Render student submission portals and feedback displays
- Manage client-side state and form validation
- Establish WebSocket connections for real-time notifications
- Handle authentication flows (login, token refresh, logout)
- Display grades, detailed feedback, and plagiarism reports

**Key Interfaces:**
- REST API: Calls NestJS backend `/api/v1/*` endpoints over HTTPS
- WebSocket: Subscribes to `notifications:{userId}` channels for real-time updates
- Local Storage: Persists user preferences, cached data, recent searches
- Session Storage: Temporary tokens, form state during submission

**Error Handling:**
- Graceful fallback if WebSocket disconnects (poll API every 30s)
- Retry failed API calls with exponential backoff
- Display user-friendly error messages

### 3.2 API Component (NestJS)

**Responsibilities:**
- Route HTTP requests to appropriate controllers
- Enforce JWT authentication and token validation
- Extract and verify tenant context from requests
- Enforce Role-Based Access Control through guards
- Orchestrate business logic across domain services
- Coordinate with external services (AI providers, Turnitin)
- Provide standard JSON response formats
- Log all requests and errors

**Key Interfaces:**
- HTTP/REST: Receives requests from frontend and external clients
- TypeORM: Communicates with PostgreSQL via repository pattern
- Redis: Caches sessions, permissions, and grades
- OpenAI SDK: Calls GPT-4 API for grading
- Anthropic SDK: Calls Claude API for grading
- AWS Bedrock SDK: Calls Bedrock models for grading
- Turnitin SDK: Submits documents for plagiarism scanning

**Module Structure:**
```
AppModule
├── AuthModule (JWT, strategies, guards)
├── InfrastructureModule (DB, cache, config)
├── RepositoryModule (Data access layer)
├── ServiceModule (Domain business logic)
├── FeatureModules
│   ├── AssignmentsModule
│   ├── SubmissionsModule
│   ├── GradingModule
│   ├── PlagiarismModule
│   ├── AnalyticsModule
│   ├── NotificationModule
│   └── UserManagementModule
├── SecurityModule (encryption, hashing)
└── Filters & Interceptors
    ├── GlobalExceptionFilter
    ├── ResponseInterceptor
    └── LoggingInterceptor
```

### 3.3 Database Component (PostgreSQL)

**Responsibilities:**
- Persist institutional data with tenant isolation via RLS
- Enforce ACID transactions for data consistency
- Maintain immutable audit trails in audit logs
- Support complex queries for analytics and reporting
- Provide full-text search for plagiarism detection

**Key Interfaces:**
- TypeORM Repository Layer: Receives queries from NestJS services
- Row-Level Security Policies: Enforces tenant isolation automatically
- Session Variables: Receives `app.current_tenant_id` context for RLS evaluation

**Core Tables:**
- `institutions` - Tenant configuration and metadata
- `users` - User accounts with roles and permissions
- `courses` - Courses owned by instructors
- `assignments` - Assignment definitions with rubrics
- `submissions` - Student submissions (versioned for incremental)
- `grades` - AI and manual grades with feedback
- `grade_overrides` - Manual overrides with audit trail
- `plagiarism_results` - Plagiarism scan results
- `audit_logs` - Immutable audit trail (append-only)

### 3.4 Cache Component (Redis)

**Responsibilities:**
- Cache frequently accessed data (sessions, permissions, grades)
- Store real-time notification delivery queues
- Implement rate limiting for API endpoints
- Manage WebSocket session subscriptions
- Provide pub/sub for broadcast notifications

**Key Interfaces:**
- NestJS Services: Sets/retrieves cached data with TTL
- Background Workers: Processes notification queues
- Pub/Sub Channels: Broadcast notifications to connected clients

**Cache Structure:**
- `session:{sessionId}` - User session data (TTL: 1 hour)
- `user:{userId}:permissions` - User's RBAC permissions (TTL: 24 hours)
- `grade:{gradeId}` - Grade details with feedback (TTL: 24 hours)
- `notifications:queue` - Queued notifications for delivery
- `plagiarism:flags:{institutionId}` - Recent plagiarism flags

### 3.5 AI Provider Components

**Responsibility:** Generate grades and feedback based on rubrics and student submissions

**Supported Providers:**
- OpenAI (GPT-4 Turbo)
- Anthropic (Claude 3 Opus)
- AWS Bedrock (Titan/Claude)

**Interface Pattern:**
```typescript
interface AIProvider {
  grade(submission: string, rubric: Rubric): Promise<GradingResult>;
  confidence(grade: number): number; // 0-1 confidence score
}

interface GradingResult {
  grade: number;           // 0-100
  confidence: number;      // 0-1
  feedback: string;
  strengths: string[];
  improvements: string[];
  codeComments?: CodeComment[];
}
```

**Error Handling:**
- Timeout: Fallback to error status, alert instructor
- Rate Limited: Retry with exponential backoff (3 attempts)
- Invalid Response: Log error, set grading status to ERROR

### 3.6 Plagiarism Service Component (Turnitin)

**Responsibility:** Detect similarity, AI-generated content, and provide source matching

**Interface Pattern:**
```typescript
interface PlagiarismService {
  scan(submission: Buffer, fileType: string): Promise<ScanResult>;
  getResult(scanId: string): Promise<ScanResult>;
}

interface ScanResult {
  overallScore: number;           // 0-100 plagiarism %
  aiGenerationScore: number;      // 0-100 AI detection %
  sourceMatches: SourceMatch[];
  suspiciousRegions: TextRegion[];
}
```

**Fallback Strategy:**
- If Turnitin unavailable: Use local institutional corpus only
- If all services down: Defer scanning, retry after 30 minutes
- Graceful degradation documented in requirement 9.1

---

## Data Models

This section specifies the core data entities, relationships, and database schema.

### 4.1 Core Entity Relationships

```
┌──────────────────────────────────────┐
│         INSTITUTION                  │
│ ├─ id (UUID)                         │
│ ├─ tenant_id (UUID)                  │
│ ├─ name, domain, timezone            │
│ ├─ plagiarism_threshold (0-100%)     │
│ ├─ ai_provider (openai|claude|aws)   │
│ ├─ created_at, updated_at            │
│ └─ deleted_at (soft delete)          │
└──────────┬──────────────────────────┘
           │ 1:N
           ▼
┌──────────────────────────────────────┐
│            USER                      │
│ ├─ id (UUID)                         │
│ ├─ tenant_id (UUID)                  │
│ ├─ email, name, role                 │
│ ├─ role: ADMIN|INSTRUCTOR|STUDENT    │
│ ├─ status: ACTIVE|INACTIVE|INVITED   │
│ ├─ password_hash, sso_provider       │
│ ├─ last_login_at                     │
│ └─ created_at, updated_at            │
└──────┬────────────────────────────┬──┘
       │ 1:N (owns)                 │ M:N (enrolled in)
       │                            │
       ▼                            ▼
┌──────────────────────────────────────┐    ┌────────────────────────────┐
│          COURSE                      │    │    COURSE_ENROLLMENT       │
│ ├─ id (UUID)                         │    │ ├─ id (UUID)               │
│ ├─ tenant_id (UUID)                  │    │ ├─ course_id (FK)          │
│ ├─ code, title, description          │    │ ├─ user_id (FK)            │
│ ├─ created_by_user_id (FK)           │    │ ├─ role: INSTRUCTOR|STUDENT│
│ ├─ semester, start_date, end_date    │    │ ├─ enrolled_at             │
│ ├─ status: ACTIVE|ARCHIVED|DRAFT     │    │ └─ dropped_at              │
│ ├─ grade_scale (A-F|0-100|GPA)       │    └────────────────────────────┘
│ └─ created_at, updated_at            │
└────────┬───────────────────────────┘
         │ 1:N
         ▼
┌──────────────────────────────────────┐
│         ASSIGNMENT                   │
│ ├─ id (UUID)                         │
│ ├─ tenant_id (UUID)                  │
│ ├─ course_id (FK)                    │
│ ├─ title, description, point_value   │
│ ├─ type: ESSAY|CODE|QUIZ|SHORT_ANSW  │
│ ├─ rubric_id (FK)                    │
│ ├─ allow_incremental: boolean        │
│ ├─ soft_deadline_at, hard_deadline   │
│ ├─ published_at, published_by_id     │
│ ├─ late_penalty_percent              │
│ └─ created_at, updated_at            │
└────────┬───────────────────────────┘
         │ 1:N
         ▼
┌──────────────────────────────────────┐
│       SUBMISSION                     │
│ ├─ id (UUID)                         │
│ ├─ tenant_id (UUID)                  │
│ ├─ assignment_id (FK)                │
│ ├─ student_id (FK)                   │
│ ├─ version (incremental counter)     │
│ ├─ content_url (S3 path)             │
│ ├─ file_type (pdf|docx|py|js|etc)    │
│ ├─ is_incremental: boolean           │
│ ├─ submitted_at, is_late: boolean    │
│ ├─ status: DRAFT|SUBMITTED|GRADED    │
│ └─ created_at, updated_at            │
└────────┬────────────────────────────┘
         │ 1:1 (latest grade)
         ▼
┌──────────────────────────────────────┐     ┌─────────────────────────────┐
│            GRADE                     │─────│    GRADE_OVERRIDE           │
│ ├─ id (UUID)                         │     │ ├─ id (UUID)                │
│ ├─ submission_id (FK)                │     │ ├─ grade_id (FK)            │
│ ├─ ai_score: decimal(0-100)          │     │ ├─ manual_score: decimal    │
│ ├─ ai_confidence: decimal(0-1)       │     │ ├─ rationale: text          │
│ ├─ final_score: decimal              │     │ ├─ approved_by_id           │
│ ├─ feedback: text                    │     │ ├─ created_at               │
│ ├─ status: PENDING|AI_GRADED|OVERRIDE    │ └─ updated_at                │
│ └─ created_at, updated_at            │     └─────────────────────────────┘
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│           RUBRIC                     │
│ ├─ id (UUID)                         │
│ ├─ tenant_id (UUID)                  │
│ ├─ name, description                 │
│ ├─ criteria: JSONB (array)           │
│ ├─ created_by_user_id (FK)           │
│ ├─ is_template: boolean              │
│ └─ created_at, updated_at            │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│      PLAGIARISM_RESULT               │
│ ├─ id (UUID)                         │
│ ├─ tenant_id (UUID)                  │
│ ├─ submission_id (FK)                │
│ ├─ overall_score: decimal(0-100)     │
│ ├─ ai_generation_score: decimal      │
│ ├─ source_matches: JSONB             │
│ ├─ suspicious_regions: JSONB         │
│ ├─ status: PENDING|FLAGGED|CLEARED   │
│ └─ scanned_at                        │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│       AUDIT_LOG                      │
│ ├─ id (UUID)                         │
│ ├─ tenant_id (UUID)                  │
│ ├─ event_type (enum)                 │
│ ├─ actor_user_id (FK)                │
│ ├─ resource_type, resource_id        │
│ ├─ action_details: JSONB             │
│ ├─ ip_address, user_agent            │
│ └─ created_at (immutable)            │
└──────────────────────────────────────┘
```

### 4.2 Rubric JSON Schema

```json
{
  "id": "uuid",
  "name": "Essay Rubric",
  "criteria": [
    {
      "id": "criterion-1",
      "name": "Thesis Clarity",
      "description": "How well the thesis statement is articulated",
      "points": 25,
      "levels": [
        {
          "name": "Exceptional",
          "points": 25,
          "description": "Clear, compelling, specific thesis"
        },
        {
          "name": "Proficient",
          "points": 20,
          "description": "Clear thesis with some specificity"
        },
        {
          "name": "Developing",
          "points": 15,
          "description": "Thesis present but lacking clarity"
        },
        {
          "name": "Beginning",
          "points": 10,
          "description": "Thesis unclear or missing"
        }
      ]
    }
  ],
  "totalPoints": 100
}
```

---

## Error Handling

This section describes error handling patterns, custom exceptions, and fallback strategies across the system.

### 5.1 Custom Exception Hierarchy

```typescript
abstract class AppException extends Error {
  constructor(
    public code: string,                    // Machine-readable error code
    public message: string,                 // User-facing message
    public statusCode: number,              // HTTP status
    public details?: Record<string, any>    // Additional context
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Specific exception types
class ValidationException extends AppException {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

class NotFoundException extends AppException {
  constructor(resourceType: string, resourceId: string) {
    super('NOT_FOUND', `${resourceType} not found: ${resourceId}`, 404);
  }
}

class UnauthorizedException extends AppException {
  constructor(message: string = 'Authentication required') {
    super('UNAUTHORIZED', message, 401);
  }
}

class ForbiddenException extends AppException {
  constructor(message: string = 'Insufficient permissions') {
    super('FORBIDDEN', message, 403);
  }
}

class ConflictException extends AppException {
  constructor(message: string, details?: any) {
    super('CONFLICT', message, 409, details);
  }
}

class GradingFailureException extends AppException {
  constructor(message: string, details?: any) {
    super('GRADING_FAILED', message, 503, {
      action: 'instructor_manual_grade_required',
      ...details
    });
  }
}

class PlagiarismScanFailureException extends AppException {
  constructor(message: string, details?: any) {
    super('PLAGIARISM_SCAN_FAILED', message, 503, {
      action: 'defer_and_retry',
      ...details
    });
  }
}

class TenantIsolationException extends AppException {
  constructor() {
    super('TENANT_ISOLATION_VIOLATION', 'Unauthorized cross-tenant access', 403);
  }
}
```

### 5.2 Global Exception Filter

```typescript
@Catch(AppException)
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('AppException');

  catch(exception: AppException, host: HttpArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Log error with full context
    this.logger.error({
      code: exception.code,
      message: exception.message,
      statusCode: exception.statusCode,
      tenantId: request.locals?.tenantId,
      userId: request.locals?.userId,
      path: request.path,
      method: request.method,
      details: exception.details,
      timestamp: new Date().toISOString()
    });

    // Return standardized error response
    response.status(exception.statusCode).json({
      success: false,
      data: null,
      error: {
        code: exception.code,
        message: exception.message,
        details: exception.details || {}
      },
      timestamp: new Date().toISOString()
    });
  }
}
```

### 5.3 AI Grading Failure Fallback

```
AI Grading Request
  ├─ [Timeout (>60s)]
  │   ├─ [Cancel request]
  │   ├─ [Log timeout event]
  │   ├─ [Create Grade with status GRADING_ERROR]
  │   ├─ [Alert instructor: "AI grading timed out. Please grade manually."]
  │   └─ [Return 503 with error details to client]
  │
  ├─ [API Error (4xx - Validation)]
  │   ├─ [Fix and retry request]
  │   ├─ [Log validation issue]
  │   └─ [If unresolvable, escalate to error status]
  │
  ├─ [API Error (4xx - Rate Limited)]
  │   ├─ [Wait with exponential backoff]
  │   ├─ [Retry 1s, 2s, 4s (max 3 attempts)]
  │   └─ [If all retries fail, set GRADING_ERROR]
  │
  ├─ [API Error (5xx - Server Error)]
  │   ├─ [Retry with exponential backoff]
  │   │   Delay: 1s, 2s, 4s (max 3 retries)
  │   └─ [If all retries fail]
  │       ├─ [Create Grade with status GRADING_ERROR]
  │       ├─ [Alert instructor]
  │       ├─ [Queue for retry in 1 hour]
  │       └─ [Log failed attempt for monitoring]
  │
  └─ [Success]
      └─ [Process grade normally]
```

### 5.4 Plagiarism Scan Failure Fallback

```
Plagiarism Scan Request
  ├─ [Turnitin API unavailable]
  │   ├─ [Check requirement 9.1: Can we scan without external service?]
  │   ├─ [Yes]
  │   │   ├─ [Use local institutional corpus only]
  │   │   ├─ [Generate plagiarism score from local matches]
  │   │   ├─ [Flag as "partial scan" with note]
  │   │   └─ [Continue normally]
  │   │
  │   └─ [No - External service required]
  │       ├─ [Create result with status PENDING]
  │       ├─ [Queue for retry]
  │       ├─ [Alert instructor: "Plagiarism scan pending"]
  │       └─ [Retry after 30 minutes]
  │
  ├─ [Rate Limited]
  │   ├─ [Retry with exponential backoff]
  │   └─ [If all retries fail, defer scanning]
  │
  └─ [Success]
      └─ [Process result normally]
```

---

## Testing Strategy

This section describes the comprehensive testing approach, including unit tests, integration tests, and property-based testing where applicable.

### 6.1 Test Pyramid

```
                    ╱╲
                  ╱    ╲    E2E Tests (5%)
                ╱        ╲  - Full workflows
              ╱────────────╲- Cross-service scenarios
            ╱                ╲
          ╱                    ╲  Integration Tests (25%)
        ╱                        ╲ - API endpoints
      ╱──────────────────────────╲- Database queries
    ╱                              ╲ - External service mocks
  ╱════════════════════════════════╲
  Unit Tests (70%)
  - Services, repositories, utilities
  - Pure functions, business logic
  - Error cases, edge conditions
```

### 6.2 Coverage Targets

- **Services**: 90%+ coverage (business logic core)
- **Controllers**: 80%+ coverage (focus on error paths and RBAC)
- **Repositories**: 95%+ coverage (data layer is critical)
- **Utilities**: 100% coverage (pure functions)
- **Overall**: 80%+ target for production readiness

### 6.3 Property-Based Testing Candidates

Property-based testing validates software correctness by testing universal properties across many generated inputs. The following features are suitable for PBT:

#### Property 1: Grade Score Valid Range

*For any* valid submission that receives an AI grade, the grade score must be a decimal number in the range [0, 100], rounded to exactly two decimal places.

**Validates: Requirements 7.3, 7.4**

Test Strategy: Generate random valid submissions, grade them, verify all scores are in valid range and properly rounded.

#### Property 2: Confidence Score Precision

*For any* AI-generated grade, the confidence score must be a decimal number in the range [0, 100], rounded to exactly two decimal places, indicating the certainty of the assessment.

**Validates: Requirements 7.4**

Test Strategy: Generate random submissions across difficulty levels, verify all confidence scores meet precision requirements.

#### Property 3: Grade Override Preserves Original

*For any* grade that is overridden by an instructor, the original AI-generated grade, confidence score, and feedback must be preserved in an immutable audit record for compliance purposes.

**Validates: Requirements 7.11, 13**

Test Strategy: Generate random AI grades, apply instructor overrides, verify original data exists in audit log.

#### Property 4: Tenant Isolation Immutability

*For any* two distinct institutions (tenants), queries executed in the context of one tenant must never return data from another tenant, regardless of the operation type or user role.

**Validates: Requirements 1.2, 19**

Test Strategy: Create multiple tenants with data, verify cross-tenant queries return empty sets.

#### Property 5: RBAC Permission Enforcement

*For any* HTTP request, if the requesting user lacks the required role or permissions for that operation, the system must deny the request and return a 403 Forbidden status, never executing the operation.

**Validates: Requirement 2**

Test Strategy: Generate random users and operations, verify unauthorized users receive 403.

#### Property 6: Plagiarism Score Threshold

*For any* submission plagiarism score that exceeds the configured institutional threshold, the system must create a plagiarism flag and alert the responsible instructor within 10 seconds.

**Validates: Requirements 9.2, 9.4**

Test Strategy: Generate scores above and below threshold, verify flagging behavior is consistent.

#### Property 7: Incremental Grading Independence

*For any* student's incremental submission graded independently, grading that submission must not modify the grades, feedback, or any other data associated with other students' submissions or versions.

**Validates: Requirement 16.1**

Test Strategy: Create multiple students, grade incremental submissions, verify peer data unchanged.

#### Property 8: Submission Late Detection Accuracy

*For any* submission received after the soft deadline, the system must correctly detect and flag it as late, applying the configured late penalty to the calculated grade.

**Validates: Requirement 6.6**

Test Strategy: Generate submissions before/after deadline with various penalty percentages, verify late flag and penalties.

#### Property 9: Rubric Serialization Round-Trip

*For any* valid rubric object, serializing it to JSON and then deserializing it must produce an equivalent rubric with identical criteria, point values, and performance levels.

**Validates: Requirement 21.6**

Test Strategy: Generate random rubrics, serialize to JSON, deserialize, verify equality.

#### Property 10: Audit Trail Immutability

*For any* audit log entry created, it must be impossible to delete, modify, or update that entry after creation. All audit events must be recorded with server-time timestamps and preserve the complete action context.

**Validates: Requirements 20.3, 20.1**

Test Strategy: Create audit entries, attempt deletes/updates (should fail), verify database constraints enforce immutability.

#### Property 11: File Type Validation

*For any* submitted file, the system must validate that the file type is in the configured allowed list for that assignment before accepting the submission; unsupported file types must be rejected with a descriptive error.

**Validates: Requirement 14.3**

Test Strategy: Generate submissions with random file types, verify validation against allowed list.

#### Property 12: Late Penalty Calculation

*For any* late submission, the applied late penalty must be calculated using the configured late_penalty_percent, resulting in a final grade no higher than (original_score - penalty).

**Validates: Requirement 12.2**

Test Strategy: Generate random scores and penalties, verify final grade calculation is correct.

### 6.4 Unit Test Structure

Example unit test for a service method:

```typescript
describe('GradingService', () => {
  let service: GradingService;
  let aiProvider: MockAIProvider;
  let gradeRepository: MockGradeRepository;

  beforeEach(async () => {
    aiProvider = createMockAIProvider();
    gradeRepository = createMockGradeRepository();
    service = new GradingService(aiProvider, gradeRepository);
  });

  describe('grade', () => {
    it('should grade a submission with valid AI response', async () => {
      // Arrange
      const submission = createValidSubmission();
      const expectedGrade = 85;
      aiProvider.mockGrade.mockResolvedValue({
        grade: expectedGrade,
        confidence: 0.92,
        feedback: 'Well-written essay',
        strengths: ['Clear thesis'],
        improvements: ['Add more citations']
      });

      // Act
      const result = await service.grade(submission);

      // Assert
      expect(result.finalScore).toBe(expectedGrade);
      expect(result.status).toBe('AI_GRADED');
      expect(gradeRepository.create).toHaveBeenCalled();
    });

    it('should handle AI provider timeout gracefully', async () => {
      // Arrange
      const submission = createValidSubmission();
      aiProvider.mockGrade.mockRejectedValue(new TimeoutError());

      // Act & Assert
      await expect(service.grade(submission)).rejects.toThrow(GradingFailureException);
    });
  });
});
```

### 6.5 Integration Test Structure

Integration tests verify multiple components working together:

```typescript
describe('Grading E2E', () => {
  it('should process full grading workflow', async () => {
    // Arrange
    const student = await createStudent(institution);
    const assignment = await createAssignment(course, rubric);
    const submission = await createSubmission(assignment, student);

    // Act
    const grade = await api.post(`/api/v1/${institutionId}/submissions/${submission.id}/grade`);

    // Assert
    expect(grade.status).toBe('AI_GRADED');
    expect(grade.finalScore).toBeGreaterThanOrEqual(0);
    expect(grade.finalScore).toBeLessThanOrEqual(100);

    // Verify persistence
    const persisted = await gradeRepository.findById(grade.id);
    expect(persisted.finalScore).toBe(grade.finalScore);
  });
});
```

---

## API Design & Endpoints

### 7.1 API Versioning & Naming Conventions

- **Base Path**: `/api/v1`
- **Tenant Scoping**: All endpoints scoped to institutional context via path parameter
- **Authentication**: JWT in `Authorization: Bearer {token}` header
- **Tenant Identification**: Extracted from JWT claims, verified via request context

### 7.2 Core Endpoints

#### Assignments
```
POST   /api/v1/{institution_id}/courses/{course_id}/assignments
       Create assignment (instructor+)
GET    /api/v1/{institution_id}/courses/{course_id}/assignments
       List assignments (instructor+)
GET    /api/v1/{institution_id}/assignments/{assignment_id}
       Get assignment details
PATCH  /api/v1/{institution_id}/assignments/{assignment_id}
       Update assignment (owner+)
POST   /api/v1/{institution_id}/assignments/{assignment_id}/publish
       Publish assignment (instructor+)
```

#### Submissions
```
POST   /api/v1/{institution_id}/assignments/{assignment_id}/submissions
       Create submission (student)
GET    /api/v1/{institution_id}/assignments/{assignment_id}/submissions
       List submissions (instructor+)
GET    /api/v1/{institution_id}/submissions/{submission_id}
       Get submission (owner/instructor+)
GET    /api/v1/{institution_id}/submissions/{submission_id}/history
       Get submission history (incremental)
```

#### Grading
```
POST   /api/v1/{institution_id}/submissions/{submission_id}/grade
       AI grade submission (system triggered or manual)
GET    /api/v1/{institution_id}/grades/{grade_id}
       Get grade details
PATCH  /api/v1/{institution_id}/grades/{grade_id}/override
       Override grade (instructor+)
       Body: { manual_score, rationale, requires_approval }
POST   /api/v1/{institution_id}/grades/{grade_id}/approve
       Approve grade override (admin, if required)
```

#### Plagiarism
```
POST   /api/v1/{institution_id}/submissions/{submission_id}/plagiarism-check
       Trigger plagiarism scan
GET    /api/v1/{institution_id}/plagiarism/{result_id}
       Get plagiarism result
POST   /api/v1/{institution_id}/plagiarism/{flag_id}/investigate
       Flag plagiarism for investigation
       Body: { action, rationale }
```

#### Analytics
```
GET    /api/v1/{institution_id}/courses/{course_id}/analytics
       Get course analytics (instructor+)
GET    /api/v1/{institution_id}/courses/{course_id}/gradebook
       Export gradebook (instructor+)
GET    /api/v1/{institution_id}/analytics/institution
       Get institutional analytics (admin)
```

### 7.3 Standard Response Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "grade": 85,
    "confidence": 0.92,
    "feedback": "Well-organized essay with clear thesis...",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "error": null,
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "SUBMISSION_ALREADY_GRADED",
    "message": "This submission has already been graded",
    "details": {
      "submissionId": "uuid",
      "existingGradeId": "uuid"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## AI Grading Pipeline

### 8.1 Grading State Machine

```
┌──────────────┐
│ SUBMITTED    │
└──────┬───────┘
       │
       ├─ [AI Grading Enabled]
       │   ↓
       ├──────────────────────────────────┐
       │                                  ▼
       │                      ┌────────────────────┐
       │                      │ AI_GRADING_       │
       │                      │ IN_PROGRESS       │
       │                      └────────┬───────────┘
       │                              │
       │                          ┌───┴────────────┐
       │                          ▼                ▼
       │                 ┌──────────────┐  ┌─────────────────┐
       │                 │ AI_GRADED    │  │ GRADING_ERROR   │
       │                 │ (confidence  │  └────────┬─────────┘
       │                 │  set)        │           │
       │                 └──────┬───────┘           │
       │                        │                   │
       │                        ▼                   ▼
       │                 ┌──────────────────────────────────┐
       │                 │ AWAITING_REVIEW                  │
       │                 │ (instructor opts to override)    │
       │                 └──────┬───────────────────────────┘
       │                        │
       │                        ▼
       │                 ┌─────────────────┐
       │                 │ OVERRIDDEN      │
       │                 │ (old score saved)│
       │                 └─────────────────┘
       │
       └─ [AI Grading Disabled]
           ↓
       ┌──────────────────────┐
       │ AWAITING_GRADE       │
       │ (manual only)        │
       └─────────┬────────────┘
                 ▼
       ┌──────────────────────┐
       │ MANUALLY_GRADED      │
       └──────────────────────┘
```

### 8.2 Grading Workflow

[AI Grading Pipeline and AI Prompt Construction - see original design sections 7.2-7.3 for complete workflow diagrams]

### 8.3 Grade Override & Approval Workflow

[See original design section 7.4 for complete override workflow]

---

## Plagiarism Detection Architecture

### 9.1 Plagiarism Scanning Workflow

[See original design section 8.1 for complete scanning workflow]

### 9.2 AI Content Detection

[See original design section 8.2 for AI detection methodology]

### 9.3 Plagiarism Investigation Workflow

[See original design section 8.3 for investigation workflow]

---

## Incremental Submission & Grading

### 10.1 Incremental Submission State

```typescript
interface SubmissionVersion {
  id: UUID;
  assignmentId: UUID;
  studentId: UUID;
  version: number;                    // 1, 2, 3... incremental counter
  isIncremental: boolean;
  content: string;
  fileType: string;
  submittedAt: Date;
  isLate: boolean;
  gradingStatus: string;              // PENDING | AI_GRADED | MANUALLY_GRADED
  grade: Grade;                       // Latest grade for this version
}
```

### 10.2 Incremental Grading Workflow

[See original design section 9.2 for complete incremental workflow]

### 10.3 Composite Grade Calculation

[See original design section 9.3 for calculation methodology]

---

## Notification System

### 11.1 Notification Types & Triggers

| Event | Trigger | Recipients | Delivery |
|-------|---------|------------|----------|
| Assignment Published | Instructor publishes | Enrolled students | Email + In-app |
| Submission Graded | AI/manual grading completes | Student | Email + In-app |
| Plagiarism Flagged | Score exceeds threshold | Instructor | Email (10s SLA) |
| Grade Overridden | Instructor overrides AI grade | Student | Email + In-app |
| Deadline Approaching | 24h before soft deadline | Student | Email |
| Late Submission | Student submits after deadline | Instructor | In-app |

### 11.2 Notification Delivery Pipeline

[See original design section 10.2 for complete delivery pipeline]

### 11.3 Real-Time Notifications (WebSocket)

[See original design section 10.3 for WebSocket patterns]

---

## Authentication & Authorization

### 12.1 Authentication Flow (JWT)

[See original design section 11.1 for JWT flow]

### 12.2 RBAC Authorization

[See original design section 11.2 for RBAC patterns]

### 12.3 Resource Ownership & Scoped Access

[See original design section 11.3 for ownership validation]

---

## Data Encryption & Security

### 13.1 Encryption Layers

[See original design section 14.1 for encryption strategy]

### 13.2 PII Anonymization on Deletion

[See original design section 14.2 for GDPR compliance]

---

## Audit Trail & Compliance

### 14.1 Immutable Audit Logging

[See original design section 15.1 for audit trail implementation]

### 14.2 FERPA Compliance Controls

[See original design section 15.2 for FERPA requirements]

### 14.3 GDPR Compliance Controls

[See original design section 15.3 for GDPR requirements]

---

## Caching Strategy

### 15.1 Cache Layers

[See original design section 13.1 for cache tiers]

### 15.2 Cache Invalidation Strategy

[See original design section 13.2 for invalidation patterns]

### 15.3 Cache Key Naming Convention

[See original design section 13.3 for key patterns]

---

## Deployment & Scaling

### 16.1 Containerization (Docker)

[See original design section 17.1 for Docker configuration]

### 16.2 AWS ECS Deployment

[See original design section 17.2 for ECS task definitions]

### 16.3 Scaling Metrics

[See original design section 17.3 for autoscaling configuration]

---

## Cost Optimization

### 17.1 AI API Cost Management

[See original design section 18.1 for token tracking and limits]

### 17.2 Database Cost Optimization

[See original design section 18.2 for database optimization]

### 17.3 Infrastructure Cost Optimization

[See original design section 18.3 for infrastructure optimization]

---

## Deployment Pipeline

### 18.1 CI/CD Flow

[See original design section 19.1 for complete CI/CD pipeline]

---

## Design Decisions & Rationales

### 19.1 Multi-Tenancy via Row-Level Security

**Decision**: Use PostgreSQL RLS policies combined with application-level tenant filtering rather than separate databases.

**Rationale**:
- Cost efficient: Single database instance vs. many separate instances
- Operational simplicity: One schema to maintain, unified migrations
- Security layering: RLS + app-level checks (defense in depth)
- Query performance: Single table benefits from economies of scale

**Trade-offs**:
- Slightly more complex schema (all tables include tenant_id)
- RLS policies can impact query planning
- Requires careful application design to avoid tenant data leakage

### 19.2 Synchronous Grading with Async Fallback

**Decision**: AI grading is synchronous for <60s submissions, with automatic async fallback for longer operations.

**Rationale**:
- Fast feedback for common cases (essays, short answers)
- Prevents timeout issues for complex submissions (code projects)
- Transparent to API client
- Instructor alerted if grading fails

### 19.3 Plagiarism Detection Independence

**Decision**: System can operate without external plagiarism service using local corpus, but continues monitoring for Turnitin availability (Requirement 9.1).

**Rationale**:
- Ensures system resilience and academic integrity workflow continuity
- Graceful degradation preserves core functionality
- Institutional data not blocked by external dependencies

### 19.4 Incremental Grading Aggregation Default

**Decision**: Composite grade defaults to average of all submissions (final + incremental), not final submission only.

**Rationale**:
- Encourages student engagement with incremental feedback loops
- Recognizes progress and improvement trajectory
- Aligns with formative assessment principles

### 19.5 Grade Override Approval Workflow

**Decision**: Grade override approval is optional per institutional policy, with no approval required by default.

**Rationale**:
- Trusts instructor expertise in assessment decisions
- Reduces administrative burden and approval delays
- Allows admin-only institutions to enforce approval if needed

---

## Summary

This technical design provides a comprehensive, implementable architecture for the AI Grading System that satisfies all business requirements while maintaining security, scalability, and compliance standards. The design emphasizes:

- **Multi-tenancy** as a first-class concern with layered enforcement
- **Security** through RBAC, encryption, audit trails, and FERPA/GDPR compliance
- **Resilience** with fallback strategies and error handling
- **Observability** through structured logging and comprehensive auditing
- **Testability** through property-based testing and clean architecture
- **Cost efficiency** through resource optimization and smart caching

Implementation should follow the module structure, API design, and data model specifications provided, while adhering to the architectural standards outlined throughout this document.
