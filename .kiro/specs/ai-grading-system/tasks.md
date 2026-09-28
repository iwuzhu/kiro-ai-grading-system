# Implementation Plan: AI Grading System

## Overview

This implementation plan orchestrates the delivery of a comprehensive AI-powered grading system across six phases, building from infrastructure foundations through core domain logic to analytics and deployment. The approach prioritizes early validation through phase gates, incremental feature delivery, and parallel work streams where dependencies allow. All 87 tasks are designed to execute sequentially within phases while enabling parallel execution across phases using the task dependency graph.

The system supports multi-tenant architecture with tenant isolation at the database level (PostgreSQL Row-Level Security), implements comprehensive RBAC for instructors and administrators, and integrates with leading AI providers (OpenAI, Anthropic, AWS Bedrock) for scalable grading. Academic integrity is enforced through a three-method plagiarism detection approach combining external APIs, institutional corpus matching, and AI content detection.

## Executive Summary

- **Total Tasks**: 87 implementation tasks
- **Total Effort**: 89 story points
- **Phases**: 6 major phases with clear dependencies
- **Timeline**: 12-16 weeks for full implementation (with team of 4-5 developers)
- **Critical Path**: Phase 1 → Phase 2 → Phase 3 → Phases 4-5 (parallel) → Phase 6

### Effort Breakdown by Phase

| Phase | Focus | Tasks | Story Points | Duration |
|-------|-------|-------|--------------|----------|
| Phase 1 | Infrastructure & Foundation | 12 | 18 | 2 weeks |
| Phase 2 | Core Domains | 18 | 24 | 3 weeks |
| Phase 3 | Submission & Grading | 22 | 28 | 3.5 weeks |
| Phase 4 | Academic Integrity | 13 | 11 | 2 weeks |
| Phase 5 | Analytics & Reporting | 12 | 5 | 1.5 weeks |
| Phase 6 | DevOps & Deployment | 10 | 3 | 1.5 weeks |

---

## Task Dependency Overview

```
PHASE 1: INFRASTRUCTURE & FOUNDATION
├── Database Schema & Migrations (1.1-1.5)
├── Authentication & JWT (1.6-1.8)
├── Configuration & Environment (1.9-1.10)
├── Security & Encryption (1.11-1.12)
└── FOUNDATION COMPLETE ✓

         ↓ (depends on Phase 1)

PHASE 2: CORE DOMAINS
├── User Management (2.1-2.5)
├── Institution Management (2.6-2.9)
├── Course Management (2.10-2.14)
├── Assignment Management (2.15-2.18)
└── CORE DOMAINS COMPLETE ✓

         ↓ (depends on Phase 2)

PHASE 3: SUBMISSION & GRADING
├── Submission System (3.1-3.6)
├── Grading Engine (3.7-3.15)
├── Feedback Generation (3.16-3.18)
├── Grade Override Workflow (3.19-3.22)
└── SUBMISSION & GRADING COMPLETE ✓

         ↓ (depends on Phase 2 + 3)

PHASE 4: ACADEMIC INTEGRITY        PHASE 5: ANALYTICS & REPORTING
├── Plagiarism Detection (4.1-4.8)  ├── Gradebook System (5.1-5.4)
├── AI Content Detection (4.9-4.10) ├── Analytics Engine (5.5-5.8)
├── Investigation Workflow (4.11-4.13) └── Reporting (5.9-5.12)
└── ACADEMIC INTEGRITY COMPLETE ✓

         ↓ (depends on all prior phases)

PHASE 6: DEVOPS & DEPLOYMENT
├── Docker & Containerization (6.1-6.3)
├── AWS & Deployment (6.4-6.7)
├── CI/CD Pipeline (6.8-6.9)
└── DEPLOYMENT COMPLETE ✓
```

---

## Tasks

The implementation is organized into six phases, each with discrete, incremental tasks that build on prior phases. Tasks are numbered with phase prefixes (1.1, 1.2, 2.1, etc.) and organized hierarchically where appropriate. Each task includes:

- **Effort**: Story points (S=2, M=4, L=6, XL=13)
- **Priority**: Critical (blocks other work), High (important), or Medium (deferrable)
- **Dependencies**: Which tasks must complete first
- **Acceptance Criteria**: Definition of done
- **Database/Backend/DevOps Work**: Specific artifacts to create
- **Property-Based Tests**: Universal correctness properties validated

All tasks are designed to be implemented by a coding agent in the order specified within each phase. The **Task Dependency Graph** section provides a wave-based scheduling model for parallel execution across phases.

---

## PHASE 1: INFRASTRUCTURE & FOUNDATION

### 1.1 Create PostgreSQL Database Schema (grading schema)
- **Effort**: XL (13 sp) | **Priority**: Critical | **Status**: [ ]
- **Dependencies**: None (Foundation task)
- **Steering Document**: database-schema-isolation.md
- **Description**: 
  - Create dedicated `grading` schema in PostgreSQL
  - Set up schema ownership and permissions
  - Configure search_path for application role
  - Grant appropriate permissions to application and admin roles
- **Acceptance Criteria**:
  - grading schema created with proper authorization
  - Application role can create tables in grading schema
  - RLS can be enabled on tables
  - Schema is isolated from other project schemas
  - _Requirement: 19_
- **Database Work**:
  - Create schema: `CREATE SCHEMA IF NOT EXISTS grading`
  - Grant usage: `GRANT USAGE ON SCHEMA grading TO application_role`
  - Configure search_path

### 1.2 Create Base Domain Entity Tables (Part 1)
- **Effort**: M (5 sp) | **Priority**: Critical | **Status**: [ ]
- **Dependencies**: 1.1
- **Description**: 
  - Create `institutions` table with tenant_id, domain, settings
  - Create `users` table with roles, auth fields
  - Create `courses` table with relationships
  - Add indices for tenant_id lookups
- **Acceptance Criteria**:
  - All tables in grading schema
  - Tenant_id is indexed and part of unique constraints
  - Foreign keys properly configured
  - _Requirement: 1, 2, 3, 4_
- **Database Work**:
  - institutions: id, tenant_id, name, domain, timezone, plagiarism_threshold, ai_provider
  - users: id, tenant_id, email, name, role, sso_provider, password_hash
  - courses: id, tenant_id, code, title, created_by_user_id, semester dates
  - course_enrollments: id, course_id, user_id, role, dates

### 1.3 Create Grading Domain Entity Tables (Part 2)
- **Effort**: M (5 sp) | **Priority**: Critical | **Status**: [ ]
- **Dependencies**: 1.2
- **Description**: 
  - Create `assignments` table with rubric support
  - Create `submissions` table (versioned for incremental support)
  - Create `grades` table with AI confidence, feedback
  - Create `grade_overrides` table with audit trail
- **Acceptance Criteria**:
  - All tables have tenant_id, timestamps, soft delete support
  - Submission versioning supported (version counter)
  - Grades linked to submissions
  - Overrides preserve original grade
  - _Requirement: 5, 6, 7, 13, 16_
- **Database Work**:
  - assignments: rubric_id, allow_incremental, soft/hard deadlines, late_penalty
  - submissions: version, is_incremental, file_type, is_late
  - grades: ai_score, confidence, feedback, status
  - grade_overrides: manual_score, rationale, approved_by

### 1.4 Create Academic Integrity & Audit Tables
- **Effort**: S (3 sp) | **Priority**: Critical | **Status**: [ ]
- **Dependencies**: 1.3
- **Description**: 
  - Create `rubrics` table with JSONB criteria
  - Create `plagiarism_results` table with scores
  - Create `plagiarism_flags` table for investigation
  - Create `audit_logs` table (immutable)
- **Acceptance Criteria**:
  - Rubric JSONB structure matches grammar specification
  - Plagiarism tables track external scan IDs
  - Audit logs are append-only (no delete/update constraints)
  - All tables have proper indices
  - _Requirement: 9, 17, 20, 21_
- **Database Work**:
  - rubrics: criteria JSONB, is_template, created_by_user_id
  - plagiarism_results: overall_score, ai_generation_score, source_matches JSONB
  - plagiarism_flags: status, action, investigation_notes
  - audit_logs: immutable with constraint, event_type, action_details JSONB

### 1.5 Create Notification & Configuration Tables
- **Effort**: S (3 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 1.4
- **Description**: 
  - Create `notifications` table for event tracking
  - Create `institution_configs` table for policies
  - Create indices for performance (tenant_id, user_id, timestamps)
  - Set up row-level security (RLS) policies
- **Acceptance Criteria**:
  - Notifications immutable once sent (sent_at timestamp)
  - Institution configs versioned for audit
  - All critical queries have indices
  - RLS policies enforce tenant isolation on all tables
  - _Requirement: 15, 1, 11_
- **Database Work**:
  - notifications: user_id, type, resource_id, sent_at, read_at
  - institution_configs: plagiarism_threshold, ai_provider, grade_scale
  - Create indices on: (tenant_id, user_id), (tenant_id, created_at), etc.
  - Enable RLS on all tables with tenant_isolation policy

### 1.6 Implement JWT Authentication Module
- **Effort**: M (5 sp) | **Priority**: Critical | **Status**: [ ]
- **Dependencies**: 1.2
- **Steering Document**: security-rbac.md
- **Description**: 
  - Create NestJS auth module with JWT strategy
  - Implement JWT payload with user, role, permissions, tenant_id
  - Create refresh token mechanism with secure cookies
  - Support both local and federated (SSO) login strategies
- **Acceptance Criteria**:
  - Access token: 1 hour expiration
  - Refresh token: 30 days expiration (secure cookie)
  - JWT payload includes sub, email, tenant_id, role, permissions
  - SSO strategy supports OAuth2 (Okta, Azure AD ready)
  - _Requirement: 2, 3_
- **Backend Work**:
  - `src/infrastructure/auth/jwt.strategy.ts`
  - `src/infrastructure/auth/jwt.service.ts`
  - `src/infrastructure/auth/sso.strategy.ts` (scaffold for OAuth2)
  - Create guards: AuthGuard, RolesGuard, TenantGuard

### 1.7 Implement Tenant Context Middleware
- **Effort**: S (3 sp) | **Priority**: Critical | **Status**: [ ]
- **Dependencies**: 1.6
- **Steering Document**: architecture-standards.md
- **Description**: 
  - Create middleware to extract tenant_id from JWT or headers
  - Validate tenant context on every request
  - Set `app.current_tenant_id` for database RLS
  - Throw UnauthorizedException if tenant_id missing
- **Acceptance Criteria**:
  - Tenant_id extracted from X-Tenant-ID header or JWT claim
  - Middleware throws 401 if missing tenant context
  - PostgreSQL session variable set for RLS evaluation
  - All controllers receive tenant_id in request context
  - _Requirement: 1, 2, 19_
- **Backend Work**:
  - `src/common/middleware/tenant.middleware.ts`
  - `src/common/decorators/current-tenant.decorator.ts`
  - Integration with NestJS request pipeline

### 1.8 Implement RBAC Guards & Decorators
- **Effort**: M (5 sp) | **Priority**: Critical | **Status**: [ ]
- **Dependencies**: 1.6
- **Steering Document**: security-rbac.md
- **Description**: 
  - Implement RolesGuard to check user role
  - Implement PermissionsGuard for granular permissions
  - Create @Roles() and @Permissions() decorators
  - Support resource-level authorization checks
- **Acceptance Criteria**:
  - @Roles(ADMIN, INSTRUCTOR) blocks students
  - @Permissions('grades:write') checked before operations
  - Resource ownership verified (e.g., instructor owns assignment)
  - Guards throw ForbiddenException (403) when unauthorized
  - _Requirement: 2_
- **Backend Work**:
  - `src/common/guards/roles.guard.ts`
  - `src/common/guards/permissions.guard.ts`
  - `src/common/decorators/roles.decorator.ts`
  - `src/common/decorators/permissions.decorator.ts`

### 1.9 Setup Environment Configuration & Secrets
- **Effort**: S (2 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: None
- **Description**: 
  - Create .env.example with all required variables
  - Set up ConfigModule in NestJS
  - Define config validation schema
  - Support environment-specific configs (dev, test, prod)
- **Acceptance Criteria**:
  - All secrets stored in environment (DB credentials, API keys, encryption keys)
  - Invalid configs rejected at startup
  - Database connection string parametrized
  - AI provider keys (OpenAI, Anthropic, Bedrock) configured
  - _Requirement: 19_
- **Backend Work**:
  - `.env.example` with all required vars
  - `src/infrastructure/config/configuration.ts`
  - Validation schema for startup checks

### 1.10 Setup Error Handling & Exception Filters
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: None
- **Description**: 
  - Create custom exception hierarchy (ValidationException, NotFoundException, etc.)
  - Implement global exception filter
  - Standardize error response format
  - Hide internal details in error messages
- **Acceptance Criteria**:
  - Custom exceptions extend AppException
  - Global filter returns standardized JSON
  - Error response includes: success=false, error.code, error.message, error.details
  - Stack traces never exposed to clients
  - _Requirement: None (infrastructure)_
- **Backend Work**:
  - `src/common/exceptions/app.exception.ts`
  - `src/common/exceptions/*-specific exceptions`
  - `src/common/filters/global-exception.filter.ts`

### 1.11 Setup Encryption Service (At-Rest)
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 1.9
- **Steering Document**: security-rbac.md
- **Description**: 
  - Implement AES-256 encryption for sensitive fields
  - Create encryption/decryption service
  - Define which fields require encryption (PII, submission content)
  - Support key rotation strategy
- **Acceptance Criteria**:
  - Sensitive data encrypted with AES-256
  - Encryption key from environment variable
  - Decryption happens transparently in services
  - Key rotation doesn't break existing data
  - _Requirement: 19_
- **Backend Work**:
  - `src/infrastructure/security/encryption.service.ts`
  - Decorators for @Encrypted fields in entities
  - Integration with TypeORM lifecycle hooks

### 1.12 Setup TLS & HTTPS Configuration
- **Effort**: S (2 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 1.9
- **Description**: 
  - Configure NestJS to use TLS 1.2+
  - Load certificates from environment
  - Setup security headers (helmet, CSP)
  - Enable HSTS for enforced HTTPS
- **Acceptance Criteria**:
  - All traffic over HTTPS
  - TLS 1.2 minimum
  - Security headers set (X-Frame-Options, CSP, etc.)
  - Certificate loading from env variables
  - _Requirement: 19_
- **Backend Work**:
  - NestJS main.ts HTTPS configuration
  - `src/common/middleware/security-headers.middleware.ts`
  - helmet() setup in AppModule

---

## PHASE 2: CORE DOMAINS

### 2.1 Implement User Entity & Repository
- **Effort**: M (4 sp) | **Priority**: Critical | **Status**: [ ]
- **Dependencies**: 1.2, 1.11
- **Description**: 
  - Create User TypeORM entity with role, permissions fields
  - Implement encrypted password hashing (bcrypt)
  - Create UserRepository with tenant-scoped queries
  - Support user status (ACTIVE, INACTIVE, INVITED)
- **Acceptance Criteria**:
  - User passwords hashed with bcrypt (10 rounds)
  - Tenant_id enforced in all queries
  - RLS policy prevents cross-tenant access
  - SSO fields support OAuth integration
  - _Requirement: 3_
- **Backend Work**:
  - `src/domain/entities/user.entity.ts`
  - `src/domain/repositories/user.repository.ts`
  - `src/infrastructure/persistence/user.typeorm-repository.ts`

### 2.2 Implement Institution Entity & Repository
- **Effort**: S (3 sp) | **Priority**: Critical | **Status**: [ ]
- **Dependencies**: 1.2
- **Description**: 
  - Create Institution TypeORM entity
  - Implement InstitutionRepository
  - Support institution provisioning workflow
  - Tenant_id linked to institution
- **Acceptance Criteria**:
  - Institution creation triggers tenant provisioning
  - Domain uniqueness enforced
  - Plagiarism threshold (0-100%) validated
  - AI provider choice (openai|claude|bedrock) validated
  - _Requirement: 1_
- **Backend Work**:
  - `src/domain/entities/institution.entity.ts`
  - `src/domain/repositories/institution.repository.ts`
  - `src/infrastructure/persistence/institution.typeorm-repository.ts`

### 2.3 Implement User Management Service
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 2.1, 2.2
- **Description**: 
  - Implement user creation, activation, deactivation
  - Support bulk CSV import with validation
  - Implement role assignment with permission validation
  - Create onboarding workflow (send emails, token generation)
- **Acceptance Criteria**:
  - Individual user creation with role assignment
  - CSV bulk import parses and validates emails
  - Role changes atomic (revoke old + grant new in transaction)
  - Inactive users blocked from login
  - SSO users created on first federated login
  - _Requirement: 3, 2_
- **Backend Work**:
  - `src/domain/services/user-management.service.ts`
  - CSV parsing logic with validation
  - Email notifications (scaffold for integration)
- **Property-Based Test**:
  - **Property 7: RBAC Enforcement** - Users cannot access resources outside permitted scope

### 2.4 Implement Institution Management Service
- **Effort**: S (3 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 2.2
- **Description**: 
  - Implement institution settings CRUD
  - Configure plagiarism thresholds, grade scales, AI providers
  - Propagate policy changes to all courses in institution
  - Create institution-level analytics queries
- **Acceptance Criteria**:
  - Policy updates applied to all courses atomically
  - Plagiarism threshold change reanalyzes flagged submissions
  - AI provider change effective for future gradings
  - Institution analytics accessible only to admins
  - _Requirement: 1, 11_
- **Backend Work**:
  - `src/domain/services/institution-management.service.ts`
  - Policy propagation logic

### 2.5 Implement User & Institution Controllers
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 2.3, 2.4
- **Description**: 
  - Create REST endpoints for user management
  - Create REST endpoints for institution management
  - Implement RBAC guards on all endpoints
  - Return standardized response envelopes
- **Acceptance Criteria**:
  - POST /api/v1/{institution_id}/users (admin only)
  - GET /api/v1/{institution_id}/users (admin/instructor)
  - PATCH /api/v1/{institution_id}/settings (admin only)
  - All responses follow standard format
  - Error responses include error.code and error.details
  - _Requirement: 2, 3_
- **Backend Work**:
  - `src/features/users/users.controller.ts`
  - `src/features/institutions/institutions.controller.ts`
  - Request/response DTOs

### 2.6 Implement Course Entity & Repository
- **Effort**: S (3 sp) | **Priority**: Critical | **Status**: [ ]
- **Dependencies**: 1.3, 2.2
- **Description**: 
  - Create Course TypeORM entity with enrollment support
  - Create CourseRepository with tenant-scoped queries
  - Support course status (ACTIVE, ARCHIVED, DRAFT)
  - Link instructor as course owner
- **Acceptance Criteria**:
  - Course_id linked to institution via tenant_id
  - Created_by_user_id tracks course owner
  - Archived courses read-only for students
  - Owner retains limited write access to archived courses
  - _Requirement: 4_
- **Backend Work**:
  - `src/domain/entities/course.entity.ts`
  - `src/domain/repositories/course.repository.ts`
  - `src/infrastructure/persistence/course.typeorm-repository.ts`

### 2.7 Implement Course Enrollment Service
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 2.6
- **Description**: 
  - Implement student enrollment (individual & bulk CSV)
  - Implement enrollment removal with history preservation
  - Support multiple enrollment roles (INSTRUCTOR, STUDENT)
  - Create CourseEnrollment entity & repository
- **Acceptance Criteria**:
  - Student added to course roster via email
  - CSV bulk import validates emails and creates enrollments
  - Enrollment removal revokes access but preserves submission history
  - Enrolled students see course in their course list
  - _Requirement: 4_
- **Backend Work**:
  - `src/domain/entities/course-enrollment.entity.ts`
  - `src/domain/repositories/course-enrollment.repository.ts`
  - `src/domain/services/course-enrollment.service.ts`

### 2.8 Implement Course Management Service
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 2.6, 2.7
- **Description**: 
  - Implement course CRUD (create, read, update, delete/archive)
  - Configure course settings (grading scale, deadline policies)
  - Create course analytics queries
  - Implement course archival logic
- **Acceptance Criteria**:
  - Only instructors can create courses
  - Only course owner can modify settings
  - Course archival preserves data but makes read-only
  - Grade scale configuration validated
  - _Requirement: 4_
- **Backend Work**:
  - `src/domain/services/course-management.service.ts`

### 2.9 Implement Course Controllers
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 2.8, 2.7
- **Description**: 
  - Create REST endpoints for course management
  - Create endpoints for course enrollment
  - Implement RBAC guards (instructors can manage, students can view)
  - Return standardized responses
- **Acceptance Criteria**:
  - POST /api/v1/{institution_id}/courses (instructor+)
  - GET /api/v1/{institution_id}/courses (students see enrolled, instructors see owned)
  - PATCH /api/v1/{institution_id}/courses/{course_id} (owner only)
  - POST /api/v1/{institution_id}/courses/{course_id}/enroll (instructor+)
  - _Requirement: 4_
- **Backend Work**:
  - `src/features/courses/courses.controller.ts`

### 2.10 Implement Assignment Entity & Repository
- **Effort**: S (3 sp) | **Priority**: Critical | **Status**: [ ]
- **Dependencies**: 2.6, 1.3
- **Description**: 
  - Create Assignment TypeORM entity
  - Support multiple assignment types (essay, code, quiz, short-answer, file)
  - Link to rubric
  - Support soft/hard deadlines and late penalties
- **Acceptance Criteria**:
  - Assignment type enum enforced
  - Rubric_id optional (can grade without rubric)
  - Soft deadline < hard deadline validation
  - Late penalty percentage (0-100%) validated
  - _Requirement: 5_
- **Backend Work**:
  - `src/domain/entities/assignment.entity.ts`
  - `src/domain/repositories/assignment.repository.ts`

### 2.11 Implement Rubric Entity & Repository
- **Effort**: S (3 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 1.4
- **Description**: 
  - Create Rubric TypeORM entity with JSONB criteria
  - Implement RubricRepository
  - Support rubric templates (is_template flag)
  - Create RubricParser & RubricSerializer (grammar compliance)
- **Acceptance Criteria**:
  - Rubric criteria stored as JSONB
  - Serialization to JSON matches Rubric Grammar
  - Parsing from JSON validates structure
  - Round-trip serialization produces equivalent object
  - Templates reusable across courses
  - _Requirement: 17, 21_
- **Backend Work**:
  - `src/domain/entities/rubric.entity.ts`
  - `src/domain/repositories/rubric.repository.ts`
  - `src/domain/parsers/rubric.parser.ts`
  - `src/domain/serializers/rubric.serializer.ts`
- **Property-Based Test**:
  - **Property 9: Rubric Serialization Round-Trip** - Parse then serialize produces equivalent

### 2.12 Implement Assignment Management Service
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 2.10, 2.11
- **Description**: 
  - Implement assignment CRUD (create, read, update, publish)
  - Validate file type support for assignment
  - Link rubric to assignment
  - Create assignment publication workflow (notify students)
- **Acceptance Criteria**:
  - Only instructors can create assignments
  - Published assignments trigger student notifications
  - Unpublished assignments hidden from students
  - Rubric modification after grading begins revalidates grades
  - File type constraints enforced per assignment
  - _Requirement: 5, 7, 15_
- **Backend Work**:
  - `src/domain/services/assignment-management.service.ts`

### 2.13 Implement Assignment Controllers
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 2.12
- **Description**: 
  - Create REST endpoints for assignment management
  - Create endpoints for rubric management
  - Implement RBAC guards
  - Return standardized responses
- **Acceptance Criteria**:
  - POST /api/v1/{institution_id}/courses/{course_id}/assignments (instructor+)
  - GET /api/v1/{institution_id}/assignments (students see published, instructors see all)
  - PATCH /api/v1/{institution_id}/assignments/{assignment_id} (owner+)
  - POST /api/v1/{institution_id}/assignments/{assignment_id}/publish (instructor+)
  - _Requirement: 5_
- **Backend Work**:
  - `src/features/assignments/assignments.controller.ts`

### 2.14 Implement Migration Scripts (Phase 2)
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: All Phase 2 entities
- **Description**: 
  - Create TypeORM migrations for all Phase 2 tables
  - Migrations: 3_create_users, 4_create_courses, 5_create_assignments, 6_create_rubrics
  - Include RLS policy creation in migrations
  - Test up/down migrations
- **Acceptance Criteria**:
  - Each migration independent and reversible
  - RLS policies created in migrations
  - Indices created for performance
  - Migration scripts named with consistent numbering
  - _Requirement: None (infrastructure)_
- **Database Work**:
  - `src/infrastructure/database/migrations/3_*.ts`
  - `src/infrastructure/database/migrations/4_*.ts`
  - etc.

---

## PHASE 3: SUBMISSION & GRADING

### 3.1 Implement Submission Entity & Repository
- **Effort**: M (4 sp) | **Priority**: Critical | **Status**: [ ]
- **Dependencies**: 2.10, 1.3
- **Description**: 
  - Create Submission TypeORM entity with versioning support
  - Support incremental submissions (version counter)
  - Track submission timestamp and late flag
  - Store file references (S3 paths) and content
- **Acceptance Criteria**:
  - Version field tracks incremental submissions
  - Is_late flag set based on deadline comparison
  - Submitted_at timestamp immutable after creation
  - File type validated on creation
  - Student can view all their submission versions
  - _Requirement: 6, 16_
- **Backend Work**:
  - `src/domain/entities/submission.entity.ts`
  - `src/domain/repositories/submission.repository.ts`

### 3.2 Implement File Handling Service (S3 Integration)
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 1.9
- **Description**: 
  - Create S3 service for file uploads/downloads
  - Implement file type validation
  - Support ZIP file extraction and validation
  - Create secure, signed URLs for file access
- **Acceptance Criteria**:
  - File type validated before upload
  - File size limits enforced (configurable)
  - ZIP files extracted and all contained files scanned
  - Submission blocked until validation completes
  - Signed URLs prevent direct S3 access
  - _Requirement: 14_
- **Backend Work**:
  - `src/infrastructure/storage/s3.service.ts`
  - File validation logic
  - ZIP extraction and validation

### 3.3 Implement Submission Management Service
- **Effort**: M (4 sp) | **Priority**: Critical | **Status**: [ ]
- **Dependencies**: 3.1, 3.2, 2.10
- **Description**: 
  - Implement submission creation and validation
  - Check deadline (soft, hard, grace period)
  - Calculate late penalties
  - Support incremental submission workflow
  - Create submission with file upload
- **Acceptance Criteria**:
  - Submission before hard deadline accepted
  - Submission after hard deadline rejected
  - Late flag and penalty calculated correctly
  - Incremental submissions allowed if enabled
  - Student sees all submission versions
  - Submission status tracked (DRAFT, SUBMITTED, GRADED)
  - _Requirement: 6, 12_
- **Backend Work**:
  - `src/domain/services/submission-management.service.ts`
  - Deadline calculation logic
  - Late penalty calculation
- **Property-Based Test**:
  - **Property 8: Submission Late Detection Accuracy** - Late submissions correctly flagged and penalized

### 3.4 Implement Grade Entity & Repository
- **Effort**: S (3 sp) | **Priority**: Critical | **Status**: [ ]
- **Dependencies**: 1.3, 3.1
- **Description**: 
  - Create Grade TypeORM entity
  - Support AI-generated and manual grades
  - Store confidence score, feedback, strengths, improvements
  - Link to submission (one grade per submission version initially)
- **Acceptance Criteria**:
  - Grade score: 0-100, rounded to 2 decimal places
  - Confidence score: 0-100, rounded to 2 decimal places
  - Feedback text stored
  - Status tracks: PENDING, AI_GRADED, MANUALLY_GRADED, OVERRIDDEN
  - Created_at immutable after creation
  - _Requirement: 7_
- **Backend Work**:
  - `src/domain/entities/grade.entity.ts`
  - `src/domain/repositories/grade.repository.ts`

### 3.5 Implement AI Provider Factory Pattern
- **Effort**: M (4 sp) | **Priority**: Critical | **Status**: [ ]
- **Dependencies**: 1.9
- **Steering Document**: ai-integration.md
- **Description**: 
  - Create AIProvider interface with grade() method
  - Implement OpenAI provider (GPT-4 Turbo)
  - Implement Anthropic provider (Claude 3 Opus)
  - Implement AWS Bedrock provider
  - Create factory to select provider based on institution config
- **Acceptance Criteria**:
  - Pluggable providers behind common interface
  - Factory selects provider from institution settings
  - Each provider has error handling (timeout, rate limit, 5xx)
  - Providers return GradingResult: grade, confidence, feedback, strengths, improvements
  - _Requirement: 7_
- **Backend Work**:
  - `src/domain/services/ai-provider.interface.ts`
  - `src/infrastructure/ai/openai-provider.ts`
  - `src/infrastructure/ai/anthropic-provider.ts`
  - `src/infrastructure/ai/bedrock-provider.ts`
  - `src/infrastructure/ai/ai-provider.factory.ts`

### 3.6 Implement Prompt Construction Service
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 2.11, 3.5
- **Steering Document**: ai-integration.md
- **Description**: 
  - Create prompt builder for rubric-based grading
  - Support different submission types (essay, code, quiz)
  - Generate structured prompts with rubric criteria
  - Support code-specific prompts with analysis focus
- **Acceptance Criteria**:
  - Prompts include: assignment description, rubric criteria, submission content
  - Code prompts include: code analysis focus, style, correctness
  - Prompt length under AI provider limits
  - Deterministic for consistency
  - _Requirement: 7_
- **Backend Work**:
  - `src/domain/services/prompt-construction.service.ts`
  - Prompt templates for each assignment type

### 3.7 Implement Grading Engine Service (Core)
- **Effort**: L (6 sp) | **Priority**: Critical | **Status**: [ ]
- **Dependencies**: 3.4, 3.5, 3.6, 2.11
- **Steering Document**: grading-rules.md
- **Description**: 
  - Orchestrate AI grading workflow
  - Call AI provider with constructed prompt
  - Parse AI response and validate grade
  - Handle timeouts and errors (see requirement 7.9)
  - Create Grade record with AI_GRADED status
  - Trigger feedback generation
- **Acceptance Criteria**:
  - Grade completion within 60 seconds for 95% of submissions
  - Timeout after 60s: set GRADING_ERROR, alert instructor
  - API error (4xx validation): fix and retry
  - API error (4xx rate limit): retry with exponential backoff (1s, 2s, 4s)
  - API error (5xx): retry with exponential backoff, then GRADING_ERROR
  - All errors logged with context
  - Grade score validated: 0-100, 2 decimal places
  - Confidence score validated: 0-100, 2 decimal places
  - _Requirement: 7_
- **Backend Work**:
  - `src/domain/services/grading-engine.service.ts`
  - Error handling with retry logic
  - Timeout management
- **Property-Based Test**:
  - **Property 1: Grade Score Valid Range** - All grades 0-100 with 2 decimal precision
  - **Property 2: Confidence Score Precision** - All confidence scores 0-100 with 2 decimal precision

### 3.8 Implement Grading Pipeline (Orchestration)
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 3.7, 3.3
- **Description**: 
  - Create workflow: submission → validate → grade → feedback → notify
  - Support incremental grading (each version graded independently)
  - Support manual grading override entry point
  - Idempotent grading (same submission graded twice gives similar results)
- **Acceptance Criteria**:
  - Submission triggers auto-grading if enabled
  - Each incremental submission graded independently
  - Manual grading skips AI provider
  - Grading pipeline atomic (no partial states)
  - Idempotent within tolerance (±2 points for AI variance)
  - _Requirement: 7, 16_
- **Backend Work**:
  - `src/domain/services/grading-pipeline.service.ts`
- **Property-Based Test**:
  - **Property 1: Grading Consistency** - Same submission produces similar grades (±2 points)

### 3.9 Implement Submission Parsing Service
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 3.1, 3.2
- **Description**: 
  - Parse various file formats: PDF, DOCX, TXT, Markdown, source code
  - Extract text content for AI analysis
  - Support code syntax extraction
  - Create SubmissionParser with plugin architecture
- **Acceptance Criteria**:
  - Extracts text from PDF, DOCX, TXT, Markdown
  - Parses code files (.py, .java, .js, .cpp, .cs, etc.)
  - Deserialization produces equivalent content for AI analysis
  - Error messages actionable and don't crash pipeline
  - _Requirement: 22_
- **Backend Work**:
  - `src/domain/services/submission-parser.service.ts`
  - File-type specific parsers
- **Property-Based Test**:
  - **Property 11: File Type Validation** - Unsupported file types rejected with descriptive error

### 3.10 Implement Feedback Generation Service
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 3.7, 2.11
- **Description**: 
  - Generate detailed feedback based on rubric and grade
  - Include specific examples from submission
  - Provide inline code comments for code submissions
  - Highlight strengths and improvements
  - Support instructor feedback customization
- **Acceptance Criteria**:
  - Feedback includes specific examples from submission
  - Feedback explains how submission meets/fails each rubric criterion
  - Code feedback includes inline comments
  - Strengths and improvements highlighted
  - Tone customizable (concise, detailed, encouraging)
  - _Requirement: 8_
- **Backend Work**:
  - `src/domain/services/feedback-generation.service.ts`
- **Property-Based Test**:
  - **Property 2: Rubric Alignment** - Feedback addresses all rubric criteria

### 3.11 Implement Incremental Grading Aggregation
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 3.4, 3.8
- **Description**: 
  - Calculate composite grade from multiple submissions
  - Support grade aggregation strategies: average, final-only, weighted
  - Default to average of all submissions
  - Track grade progression across versions
- **Acceptance Criteria**:
  - Composite grade calculated as average of all version grades
  - Final submission grade also available separately
  - Grade progression queryable (show improvement over time)
  - Comparative feedback references prior versions
  - Instructor can see version-by-version breakdown
  - _Requirement: 16_
- **Backend Work**:
  - `src/domain/services/incremental-grade-aggregation.service.ts`
- **Property-Based Test**:
  - **Property 4: No Data Loss in Incremental Grading** - All submission grades preserved

### 3.12 Implement Grade Override Entity & Workflow
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 3.4
- **Description**: 
  - Create GradeOverride entity to track instructor changes
  - Preserve original AI grade in override record
  - Store rationale and timestamp
  - Support optional approval workflow
- **Acceptance Criteria**:
  - Original grade preserved in GradeOverride record
  - Override recorded with instructor ID, timestamp, rationale
  - Audit trail shows original → override transition
  - Optional approval routing if institutional policy requires
  - Override takes effect immediately if no approval required
  - _Requirement: 7, 13_
- **Backend Work**:
  - `src/domain/entities/grade-override.entity.ts`
  - `src/domain/repositories/grade-override.repository.ts`
- **Property-Based Test**:
  - **Property 3: Grade Override Preserves Original** - Original grade preserved in audit record

### 3.13 Implement Grade Override Service
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 3.12
- **Description**: 
  - Implement grade override logic with validation
  - Check instructor authorization
  - Record override with full audit trail
  - Route to approval workflow if required
  - Update final grade calculation
- **Acceptance Criteria**:
  - Only instructors/admins can override grades
  - Rationale required for override
  - Original grade immutably recorded
  - Approval workflow triggered per institutional policy
  - Override effective immediately (no approval) or pending (approval required)
  - Student notified of override
  - _Requirement: 7, 13_
- **Backend Work**:
  - `src/domain/services/grade-override.service.ts`

### 3.14 Implement Grading Controllers
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 3.7, 3.13
- **Description**: 
  - Create REST endpoints for grading operations
  - POST /api/v1/{institution_id}/submissions/{submission_id}/grade (system/manual)
  - GET /api/v1/{institution_id}/grades/{grade_id}
  - PATCH /api/v1/{institution_id}/grades/{grade_id}/override (instructor+)
  - Implement RBAC guards
- **Acceptance Criteria**:
  - Grade creation endpoint returns Grade with scores, feedback, confidence
  - Override endpoint updates grade and creates audit trail
  - Instructor can only override grades they own
  - Student sees their grades and feedback
  - _Requirement: 7_
- **Backend Work**:
  - `src/features/grading/grading.controller.ts`
  - Request/response DTOs

### 3.15 Implement Submission Controllers
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 3.3, 3.2
- **Description**: 
  - Create REST endpoints for submission operations
  - POST /api/v1/{institution_id}/assignments/{assignment_id}/submissions (student)
  - GET /api/v1/{institution_id}/submissions/{submission_id} (student/instructor)
  - GET /api/v1/{institution_id}/submissions/{submission_id}/history (incremental)
  - Implement file upload integration
- **Acceptance Criteria**:
  - Student can submit files (single or ZIP)
  - File validation happens before acceptance
  - Student can view all their submission versions
  - Instructor can view all course submissions
  - _Requirement: 6_
- **Backend Work**:
  - `src/features/submissions/submissions.controller.ts`
  - File upload handling

### 3.16 Implement Notification Service
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 1.5, 3.1
- **Description**: 
  - Implement notification creation and delivery
  - Support multiple delivery channels: email, in-app, SMS (scaffold)
  - Create notification queue (Redis)
  - Implement background worker for notification delivery
- **Acceptance Criteria**:
  - Notifications created in database (immutable)
  - Notifications queued for delivery
  - Email delivery via SMTP
  - In-app notifications stored in database
  - User notification preferences respected
  - Failed delivery retried with backoff
  - _Requirement: 15_
- **Backend Work**:
  - `src/domain/services/notification.service.ts`
  - `src/infrastructure/messaging/notification-queue.service.ts`
  - Background worker (or Bull job processor)

### 3.17 Implement Real-Time Notifications (WebSocket)
- **Effort**: M (4 sp) | **Priority**: Medium | **Status**: [ ]
- **Dependencies**: 3.16
- **Description**: 
  - Setup WebSocket connection handling
  - Create subscription model: notifications:{userId}
  - Broadcast grade notifications to students
  - Broadcast plagiarism alerts to instructors
  - Graceful fallback if WebSocket disconnects
- **Acceptance Criteria**:
  - Students receive grade notifications in real-time via WebSocket
  - Instructors receive plagiarism alerts via WebSocket
  - Client polls API every 30s if WebSocket disconnected
  - WebSocket reconnection automatic
  - _Requirement: 15_
- **Backend Work**:
  - `src/infrastructure/websocket/notifications.gateway.ts`
  - WebSocket subscription management

### 3.18 Implement Notification Controllers & Events
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 3.16
- **Description**: 
  - Create event emitters for: assignment_published, grade_ready, plagiarism_flagged, grade_overridden
  - Create notification triggers for each event
  - Create REST endpoints for notification preferences
  - Implement notification preferences storage
- **Acceptance Criteria**:
  - Assignment published → students notified
  - Grade ready → student notified with grade link
  - Plagiarism flagged → instructor alerted within 10s
  - Grade overridden → student notified
  - User preferences respected (email, in-app, SMS)
  - _Requirement: 15_
- **Backend Work**:
  - Event emitters in domain services
  - Notification preference service

### 3.19 Implement Migration Scripts (Phase 3)
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: All Phase 3 entities
- **Description**: 
  - Create TypeORM migrations for all Phase 3 tables
  - Migrations: 7_create_submissions, 8_create_grades, 9_create_overrides
  - Include cascading deletes and foreign key constraints
- **Acceptance Criteria**:
  - Migrations reversible and independent
  - Foreign key constraints ensure referential integrity
  - Indices on frequently queried columns
  - _Requirement: None (infrastructure)_
- **Database Work**:
  - `src/infrastructure/database/migrations/7_*.ts`
  - `src/infrastructure/database/migrations/8_*.ts`
  - `src/infrastructure/database/migrations/9_*.ts`

---

## PHASE 4: ACADEMIC INTEGRITY

### 4.1 Implement Plagiarism Result Entity & Repository
- **Effort**: S (3 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 1.4, 3.1
- **Description**: 
  - Create PlagiarismResult TypeORM entity
  - Store plagiarism_score, ai_generation_score, source_matches (JSONB)
  - Track external scan IDs (Turnitin)
  - Support status tracking (PENDING, SCANNED, FLAGGED, CLEARED)
- **Acceptance Criteria**:
  - Scores stored as decimal 0-100
  - Source matches captured with citation info
  - External scan ID links to Turnitin result
  - Status transitions validated
  - _Requirement: 9_
- **Backend Work**:
  - `src/domain/entities/plagiarism-result.entity.ts`
  - `src/domain/repositories/plagiarism-result.repository.ts`

### 4.2 Implement Plagiarism Flag Entity & Repository
- **Effort**: S (2 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 4.1
- **Description**: 
  - Create PlagiarismFlag entity for investigation workflow
  - Track investigation status and instructor actions
  - Store investigation notes
  - Link plagiarism result to flag
- **Acceptance Criteria**:
  - Flag created when score exceeds threshold
  - Status: FLAGGED, INVESTIGATING, RESOLVED, DISMISSED
  - Investigation notes captured
  - Action recorded (warning, investigation, dismissal)
  - _Requirement: 9_
- **Backend Work**:
  - `src/domain/entities/plagiarism-flag.entity.ts`
  - `src/domain/repositories/plagiarism-flag.repository.ts`

### 4.3 Implement Turnitin Integration Service
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 1.9, 3.2
- **Steering Document**: plagiarism-detection.md
- **Description**: 
  - Create Turnitin API client wrapper
  - Implement document submission to Turnitin
  - Poll for scan completion
  - Parse plagiarism score and source matches
  - Handle API errors (timeout, rate limit, unavailable)
- **Acceptance Criteria**:
  - Submission to Turnitin via API
  - Polling for scan status (max 120s)
  - Plagiarism score extracted (0-100)
  - AI content detection included
  - Source matches captured
  - API failures trigger fallback (local corpus only)
  - _Requirement: 9_
- **Backend Work**:
  - `src/infrastructure/plagiarism/turnitin.service.ts`

### 4.4 Implement Local Corpus Service (Fallback)
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 3.1
- **Steering Document**: plagiarism-detection.md
- **Description**: 
  - Create local submission corpus in PostgreSQL
  - Implement similarity search using pg_trgm or similar
  - Calculate plagiarism score from local matches
  - Support incremental corpus building
- **Acceptance Criteria**:
  - Previous submissions indexed in corpus
  - Similarity search finds matches (>80% threshold)
  - Score calculated from local matches
  - Corpus grows with each submission
  - Can scan even if Turnitin unavailable
  - _Requirement: 9_
- **Backend Work**:
  - `src/infrastructure/plagiarism/local-corpus.service.ts`
  - Database indices for text search

### 4.5 Implement Plagiarism Scanning Service
- **Effort**: M (4 sp) | **Priority**: Critical | **Status**: [ ]
- **Dependencies**: 4.3, 4.4
- **Steering Document**: plagiarism-detection.md
- **Description**: 
  - Orchestrate plagiarism scanning workflow
  - Try Turnitin first; fallback to local corpus
  - Handle timeouts and errors gracefully
  - Create PlagiarismResult record
  - Trigger flagging if score exceeds threshold
- **Acceptance Criteria**:
  - Attempts Turnitin API scan
  - Timeout after 120s: defer and retry later
  - API unavailable: uses local corpus only
  - Score calculated (0-100)
  - Result stored with status SCANNED
  - Flag created if score >= threshold
  - _Requirement: 9_
- **Backend Work**:
  - `src/domain/services/plagiarism-scanning.service.ts`
- **Property-Based Test**:
  - **Property 6: Plagiarism Score Threshold** - Submissions above threshold flagged

### 4.6 Implement AI Content Detection Service
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 3.9
- **Steering Document**: plagiarism-detection.md
- **Description**: 
  - Implement AI content detection analysis
  - Use established AI detection models (support multiple strategies)
  - Return AI-generation score (0-100%)
  - Identify AI-generated regions
  - Distinguish from plagiarism (can be both)
- **Acceptance Criteria**:
  - AI content score: 0-100%
  - TPR (true positive rate) > 80% for AI content
  - FPR (false positive rate) < 10% for human content
  - Score included in PlagiarismResult
  - Can flag independently of plagiarism score
  - _Requirement: 9_
- **Backend Work**:
  - `src/infrastructure/plagiarism/ai-detection.service.ts`
- **Property-Based Test**:
  - **Property 6: AI Content Detection Accuracy** - AI content detected with higher accuracy than human

### 4.7 Implement Plagiarism Flag Service
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 4.5, 2.4
- **Description**: 
  - Create plagiarism flags automatically when threshold exceeded
  - Send instructor alert within 10 seconds
  - Support threshold override per course
  - Create investigation workflow entry point
- **Acceptance Criteria**:
  - Flag created when plagiarism_score >= institution_threshold
  - Instructor alerted via notification (email, in-app)
  - Alert sent within 10 seconds
  - Flag status initialized as FLAGGED
  - Instructor can investigate or dismiss
  - _Requirement: 9, 11_
- **Backend Work**:
  - `src/domain/services/plagiarism-flag.service.ts`

### 4.8 Implement Plagiarism Investigation Workflow
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 4.7
- **Description**: 
  - Implement investigation status transitions
  - Record investigator actions (warning, escalation, dismissal)
  - Create detailed investigation notes
  - Archive plagiarism evidence
- **Acceptance Criteria**:
  - Flag status: FLAGGED → INVESTIGATING → RESOLVED
  - Actions logged with timestamp and actor
  - Investigation notes captured
  - Evidence preserved (plagiarism result, source matches)
  - Audit trail shows investigation history
  - _Requirement: 9_
- **Backend Work**:
  - `src/domain/services/plagiarism-investigation.service.ts`

### 4.9 Implement Three-Method Plagiarism Detection
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 4.3, 4.4, 4.6
- **Steering Document**: plagiarism-detection.md
- **Description**: 
  - Method 1: External API (Turnitin) for comprehensive detection
  - Method 2: Local corpus matching for institutional history
  - Method 3: AI content detection for synthetic content
  - Combine scores into unified plagiarism assessment
- **Acceptance Criteria**:
  - All three methods attempted
  - Highest score from available methods used
  - AI detection separate from plagiarism (can flag both)
  - Hybrid approach resilient to service failures
  - _Requirement: 9_
- **Backend Work**:
  - Multi-method orchestration in plagiarism-scanning.service

### 4.10 Implement Plagiarism Controllers
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 4.5, 4.7, 4.8
- **Description**: 
  - Create REST endpoints for plagiarism operations
  - POST /api/v1/{institution_id}/submissions/{submission_id}/plagiarism-check
  - GET /api/v1/{institution_id}/plagiarism/{result_id}
  - POST /api/v1/{institution_id}/plagiarism/{flag_id}/investigate
  - Implement RBAC guards (instructors only)
- **Acceptance Criteria**:
  - Endpoints trigger scanning and return results
  - Investigation endpoint records actions
  - Only instructors/admins can access plagiarism data
  - Results include: overall_score, ai_generation_score, source_matches
  - _Requirement: 9_
- **Backend Work**:
  - `src/features/plagiarism/plagiarism.controller.ts`

### 4.11 Implement Migration Scripts (Phase 4)
- **Effort**: S (2 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: All Phase 4 entities
- **Description**: 
  - Create TypeORM migrations for plagiarism tables
  - Migrations: 10_create_plagiarism_results, 11_create_plagiarism_flags
- **Acceptance Criteria**:
  - Migrations reversible
  - Foreign key constraints enforced
  - Indices on plagiarism_score for filtering
  - _Requirement: None (infrastructure)_
- **Database Work**:
  - `src/infrastructure/database/migrations/10_*.ts`
  - `src/infrastructure/database/migrations/11_*.ts`

---

## PHASE 5: ANALYTICS & REPORTING

### 5.1 Implement Gradebook Query Service
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 3.4, 2.6, 2.7
- **Description**: 
  - Create efficient queries for gradebook display
  - Aggregate submissions and grades per student
  - Support filtering and sorting
  - Calculate course grades
- **Acceptance Criteria**:
  - Gradebook query returns: students, assignments, grades
  - Filters by: student name, grade range, completion status
  - Sorts by: name, grade, submission status
  - Course grade calculated from assignment grades
  - _Requirement: 10, 18_
- **Backend Work**:
  - `src/domain/services/gradebook-query.service.ts`

### 5.2 Implement Analytics Service
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 5.1, 3.4
- **Description**: 
  - Calculate course analytics: mean grade, median, quartiles, distribution
  - Identify struggling students (below threshold)
  - Track submission completion rates
  - Generate trend reports
- **Acceptance Criteria**:
  - Grade statistics: mean, median, std dev, quartiles
  - Student performance below configurable threshold highlighted
  - Submission completion rate by student and assignment
  - Trend analysis shows grade progression over time
  - _Requirement: 10_
- **Backend Work**:
  - `src/domain/services/analytics.service.ts`

### 5.3 Implement Gradebook Export Service
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 5.1
- **Description**: 
  - Export gradebook to CSV, Excel, PDF
  - Support multiple export formats
  - Include student names, assignments, grades
  - Format grades per institutional policy
- **Acceptance Criteria**:
  - CSV export: comma-delimited, can import to Excel
  - Excel export: formatted with headers
  - PDF export: printer-friendly table
  - Grades formatted per institution (letter, %, GPA)
  - Student data anonymizable for privacy
  - _Requirement: 10, 18_
- **Backend Work**:
  - `src/domain/services/export.service.ts`
  - CSV/Excel/PDF generators

### 5.4 Implement Gradebook Controllers
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 5.1, 5.2, 5.3
- **Description**: 
  - Create REST endpoints for gradebook
  - GET /api/v1/{institution_id}/courses/{course_id}/gradebook
  - GET /api/v1/{institution_id}/courses/{course_id}/analytics
  - GET /api/v1/{institution_id}/courses/{course_id}/export?format=csv|excel|pdf
  - Implement RBAC (instructors/admins only)
- **Acceptance Criteria**:
  - Gradebook endpoint returns paginated results
  - Analytics endpoint returns statistics
  - Export endpoint returns downloadable file
  - Only course instructors/admins can access
  - _Requirement: 10, 18_
- **Backend Work**:
  - `src/features/analytics/analytics.controller.ts`

### 5.5 Implement Compliance Report Service
- **Effort**: M (4 sp) | **Priority**: Medium | **Status**: [ ]
- **Dependencies**: 1.5, 3.4, 4.1
- **Description**: 
  - Generate audit reports for compliance
  - Filter audit logs by: user, action, date range, resource
  - Export audit logs in standard format
  - Create FERPA compliance report (student record access)
  - Create GDPR compliance report (data processing)
- **Acceptance Criteria**:
  - Audit log filtering and export
  - FERPA report: who accessed student records, when
  - GDPR report: data categories, retention, deletion
  - Timestamps in UTC
  - Exportable to CSV for audit
  - _Requirement: 20_
- **Backend Work**:
  - `src/domain/services/compliance-report.service.ts`

### 5.6 Implement Institution Analytics Service
- **Effort**: S (2 sp) | **Priority**: Medium | **Status**: [ ]
- **Dependencies**: 5.2
- **Description**: 
  - Calculate institution-level analytics
  - Course count, active students, submissions per month
  - Grade distribution across courses
  - Student outcomes tracking
- **Acceptance Criteria**:
  - Admin dashboard shows: course count, active users, submissions
  - Grade distribution across all courses
  - Monthly submission volume
  - Student outcome tracking
  - _Requirement: 1_
- **Backend Work**:
  - `src/domain/services/institution-analytics.service.ts`

### 5.7 Implement Data Anonymization Service
- **Effort**: M (4 sp) | **Priority**: Medium | **Status**: [ ]
- **Dependencies**: 1.11, 3.1
- **Description**: 
  - Support data export for individual users (GDPR right to export)
  - Support account deletion with PII anonymization
  - Anonymize test/development data
  - Preserve grades with anonymized student references
- **Acceptance Criteria**:
  - User data export includes: profile, submissions, grades, feedback
  - Deletion request anonymizes: name, email, enrollment records
  - Grades retained with anonymized student ID
  - Audit trail remains (actor anonymized)
  - Deletion completed within 30 days
  - _Requirement: 19_
- **Backend Work**:
  - `src/domain/services/data-anonymization.service.ts`

### 5.8 Implement Dashboard Controllers
- **Effort**: M (4 sp) | **Priority**: Medium | **Status**: [ ]
- **Dependencies**: 5.2, 5.6
- **Description**: 
  - Create REST endpoints for dashboards
  - GET /api/v1/{institution_id}/analytics/dashboard (admin)
  - GET /api/v1/{institution_id}/courses/{course_id}/dashboard (instructor)
  - Implement caching for performance
- **Acceptance Criteria**:
  - Admin dashboard: institution overview, course stats
  - Instructor dashboard: course performance, student progress
  - Response cached for 5 minutes
  - _Requirement: 10_
- **Backend Work**:
  - `src/features/dashboards/dashboards.controller.ts`

---

## PHASE 6: DEVOPS & DEPLOYMENT

### 6.1 Create Dockerfile & Docker Compose
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: All prior phases
- **Description**: 
  - Create multi-stage Dockerfile for NestJS application
  - Build stage: npm install, build, compile
  - Runtime stage: lean Node image, run production
  - Create docker-compose.yml for local development
  - Include PostgreSQL, Redis services
- **Acceptance Criteria**:
  - Dockerfile builds successfully
  - Runtime image lean (<300MB)
  - docker-compose starts all services
  - Development environment matches production
  - _Requirement: None (infrastructure)_
- **DevOps Work**:
  - `Dockerfile`
  - `docker-compose.yml`
  - `.dockerignore`

### 6.2 Create AWS ECS Task Definition
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 6.1
- **Description**: 
  - Create ECS task definition for NestJS service
  - Configure container specs: memory, CPU, port mappings
  - Setup environment variable injection from Secrets Manager
  - Configure CloudWatch logging
  - Setup health checks
- **Acceptance Criteria**:
  - Task definition valid JSON
  - Memory/CPU specs support 100+ concurrent users
  - Environment variables from Secrets Manager
  - CloudWatch logs sent from container
  - Health check endpoint (/health) configured
  - _Requirement: None (infrastructure)_
- **DevOps Work**:
  - ECS task definition JSON
  - Health check endpoint in NestJS

### 6.3 Setup Database Backup & Recovery
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 1.1-1.5
- **Description**: 
  - Configure automated PostgreSQL backups to S3
  - Setup daily backups, retention policy
  - Document backup schedule and recovery procedures
  - Test backup restoration
- **Acceptance Criteria**:
  - Daily backups run automatically
  - Backups uploaded to S3
  - Retention: 30 days daily, 12 weeks weekly
  - Recovery tested (restore from backup)
  - Documentation complete
  - _Requirement: None (infrastructure)_
- **DevOps Work**:
  - Backup script (AWS Lambda or cron)
  - S3 lifecycle policy
  - Recovery procedures documented

### 6.4 Setup AWS RDS PostgreSQL
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: None
- **Description**: 
  - Create RDS PostgreSQL database
  - Configure: version, instance type, storage, backups
  - Setup security group rules (only ECS access)
  - Enable Multi-AZ for high availability
  - Configure CloudWatch monitoring
- **Acceptance Criteria**:
  - RDS instance created and accessible
  - Security group restricts to ECS tasks only
  - Multi-AZ enabled
  - Automated backups configured (7-day retention)
  - CloudWatch alarms for CPU, disk space
  - _Requirement: None (infrastructure)_
- **DevOps Work**:
  - AWS RDS configuration (CloudFormation or Terraform)

### 6.5 Setup AWS ElastiCache Redis
- **Effort**: S (2 sp) | **Priority**: Medium | **Status**: [ ]
- **Dependencies**: None
- **Description**: 
  - Create ElastiCache Redis cluster
  - Configure: node type, number of nodes, subnet group
  - Setup security group (ECS access only)
  - Enable automatic failover
- **Acceptance Criteria**:
  - Redis cluster operational
  - ECS tasks can connect
  - Automatic failover enabled
  - CloudWatch monitoring configured
  - _Requirement: None (infrastructure)_
- **DevOps Work**:
  - AWS ElastiCache configuration

### 6.6 Setup AWS S3 for File Storage
- **Effort**: S (2 sp) | **Priority**: Medium | **Status**: [ ]
- **Dependencies**: None
- **Description**: 
  - Create S3 bucket for submissions and backups
  - Configure bucket encryption (AES-256)
  - Setup versioning for accidental deletion recovery
  - Configure IAM policy for ECS access
  - Enable CloudTrail logging for audit
- **Acceptance Criteria**:
  - S3 bucket created and secured
  - Encryption enabled
  - Versioning enabled
  - ECS IAM policy allows read/write
  - CloudTrail logs API calls
  - _Requirement: 19_
- **DevOps Work**:
  - S3 bucket and IAM policy configuration

### 6.7 Setup AWS Secrets Manager
- **Effort**: S (2 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: None
- **Description**: 
  - Create secrets for: DB credentials, API keys, encryption keys, JWT secret
  - Setup secret rotation policies
  - Grant ECS task role access to secrets
  - Document secret naming convention
- **Acceptance Criteria**:
  - All secrets stored in Secrets Manager
  - Automatic rotation enabled (30 days)
  - ECS tasks can retrieve secrets
  - Secret names follow convention: /grading/{env}/{key}
  - _Requirement: 19_
- **DevOps Work**:
  - AWS Secrets Manager setup

### 6.8 Setup CI/CD Pipeline (GitHub Actions)
- **Effort**: L (5 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 6.1-6.7
- **Description**: 
  - Create GitHub Actions workflow for: test, build, deploy
  - Run tests on every PR
  - Build Docker image on main branch merge
  - Push image to ECR
  - Deploy to ECS on successful build
  - Rollback on deployment failure
- **Acceptance Criteria**:
  - Workflow runs unit tests (>80% coverage required)
  - Integration tests run before deployment
  - Docker image built and pushed to ECR
  - ECS deployment triggered automatically
  - Rollback available if issues detected
  - Deployment notifications sent
  - _Requirement: None (infrastructure)_
- **DevOps Work**:
  - `.github/workflows/ci-cd.yml`
  - Test coverage thresholds
  - Deployment stage configuration

### 6.9 Setup Monitoring & Alerting
- **Effort**: M (4 sp) | **Priority**: High | **Status**: [ ]
- **Dependencies**: 6.2, 6.4, 6.5
- **Description**: 
  - Configure CloudWatch dashboards for key metrics
  - Setup alarms: API error rate, database CPU, memory usage
  - Integrate with Slack/PagerDuty for alerting
  - Configure structured logging with correlation IDs
  - Setup performance monitoring (APM)
- **Acceptance Criteria**:
  - CloudWatch dashboard shows: requests, errors, latency, database metrics
  - Alarms configured: error rate > 5%, DB CPU > 80%, memory > 85%
  - Slack notifications for critical alerts
  - Logs include correlation IDs for tracing
  - Performance metrics tracked (p50, p95, p99 latency)
  - _Requirement: None (infrastructure)_
- **DevOps Work**:
  - CloudWatch dashboard JSON
  - Alarm configurations
  - Logging configuration in NestJS

### 6.10 Setup API Rate Limiting & CORS
- **Effort**: S (2 sp) | **Priority**: Medium | **Status**: [ ]
- **Dependencies**: 1.8
- **Description**: 
  - Implement API rate limiting (10 requests/minute per IP)
  - Configure CORS for frontend origin
  - Setup API versioning (/api/v1)
  - Document API rate limits and response headers
- **Acceptance Criteria**:
  - Rate limiting header: X-RateLimit-Remaining
  - CORS allows only frontend origin
  - 429 Too Many Requests returned on limit exceeded
  - API versioning in path
  - _Requirement: None (infrastructure)_
- **Backend Work**:
  - ThrottleGuard configuration
  - CORS middleware setup

---

## Task Summary Table

| Task ID | Title | Phase | Effort | Priority | Status |
|---------|-------|-------|--------|----------|--------|
| 1.1 | Create PostgreSQL Database Schema (grading schema) | 1 | XL | Critical | [ ] |
| 1.2 | Create Base Domain Entity Tables (Part 1) | 1 | M | Critical | [ ] |
| 1.3 | Create Grading Domain Entity Tables (Part 2) | 1 | M | Critical | [ ] |
| 1.4 | Create Academic Integrity & Audit Tables | 1 | S | Critical | [ ] |
| 1.5 | Create Notification & Configuration Tables | 1 | S | High | [ ] |
| 1.6 | Implement JWT Authentication Module | 1 | M | Critical | [ ] |
| 1.7 | Implement Tenant Context Middleware | 1 | S | Critical | [ ] |
| 1.8 | Implement RBAC Guards & Decorators | 1 | M | Critical | [ ] |
| 1.9 | Setup Environment Configuration & Secrets | 1 | S | High | [ ] |
| 1.10 | Setup Error Handling & Exception Filters | 1 | M | High | [ ] |
| 1.11 | Setup Encryption Service (At-Rest) | 1 | M | High | [ ] |
| 1.12 | Setup TLS & HTTPS Configuration | 1 | S | High | [ ] |
| 2.1 | Implement User Entity & Repository | 2 | M | Critical | [ ] |
| 2.2 | Implement Institution Entity & Repository | 2 | S | Critical | [ ] |
| 2.3 | Implement User Management Service | 2 | M | High | [ ] |
| 2.4 | Implement Institution Management Service | 2 | S | High | [ ] |
| 2.5 | Implement User & Institution Controllers | 2 | M | High | [ ] |
| 2.6 | Implement Course Entity & Repository | 2 | S | Critical | [ ] |
| 2.7 | Implement Course Enrollment Service | 2 | M | High | [ ] |
| 2.8 | Implement Course Management Service | 2 | M | High | [ ] |
| 2.9 | Implement Course Controllers | 2 | M | High | [ ] |
| 2.10 | Implement Assignment Entity & Repository | 2 | S | Critical | [ ] |
| 2.11 | Implement Rubric Entity & Repository | 2 | S | High | [ ] |
| 2.12 | Implement Assignment Management Service | 2 | M | High | [ ] |
| 2.13 | Implement Assignment Controllers | 2 | M | High | [ ] |
| 2.14 | Implement Migration Scripts (Phase 2) | 2 | M | High | [ ] |
| 3.1 | Implement Submission Entity & Repository | 3 | M | Critical | [ ] |
| 3.2 | Implement File Handling Service (S3 Integration) | 3 | M | High | [ ] |
| 3.3 | Implement Submission Management Service | 3 | M | Critical | [ ] |
| 3.4 | Implement Grade Entity & Repository | 3 | S | Critical | [ ] |
| 3.5 | Implement AI Provider Factory Pattern | 3 | M | Critical | [ ] |
| 3.6 | Implement Prompt Construction Service | 3 | M | High | [ ] |
| 3.7 | Implement Grading Engine Service (Core) | 3 | L | Critical | [ ] |
| 3.8 | Implement Grading Pipeline (Orchestration) | 3 | M | High | [ ] |
| 3.9 | Implement Submission Parsing Service | 3 | M | High | [ ] |
| 3.10 | Implement Feedback Generation Service | 3 | M | High | [ ] |
| 3.11 | Implement Incremental Grading Aggregation | 3 | M | High | [ ] |
| 3.12 | Implement Grade Override Entity & Workflow | 3 | M | High | [ ] |
| 3.13 | Implement Grade Override Service | 3 | M | High | [ ] |
| 3.14 | Implement Grading Controllers | 3 | M | High | [ ] |
| 3.15 | Implement Submission Controllers | 3 | M | High | [ ] |
| 3.16 | Implement Notification Service | 3 | M | High | [ ] |
| 3.17 | Implement Real-Time Notifications (WebSocket) | 3 | M | Medium | [ ] |
| 3.18 | Implement Notification Controllers & Events | 3 | M | High | [ ] |
| 3.19 | Implement Migration Scripts (Phase 3) | 3 | M | High | [ ] |
| 4.1 | Implement Plagiarism Result Entity & Repository | 4 | S | High | [ ] |
| 4.2 | Implement Plagiarism Flag Entity & Repository | 4 | S | High | [ ] |
| 4.3 | Implement Turnitin Integration Service | 4 | M | High | [ ] |
| 4.4 | Implement Local Corpus Service (Fallback) | 4 | M | High | [ ] |
| 4.5 | Implement Plagiarism Scanning Service | 4 | M | Critical | [ ] |
| 4.6 | Implement AI Content Detection Service | 4 | M | High | [ ] |
| 4.7 | Implement Plagiarism Flag Service | 4 | M | High | [ ] |
| 4.8 | Implement Plagiarism Investigation Workflow | 4 | M | High | [ ] |
| 4.9 | Implement Three-Method Plagiarism Detection | 4 | M | High | [ ] |
| 4.10 | Implement Plagiarism Controllers | 4 | M | High | [ ] |
| 4.11 | Implement Migration Scripts (Phase 4) | 4 | S | High | [ ] |
| 5.1 | Implement Gradebook Query Service | 5 | M | High | [ ] |
| 5.2 | Implement Analytics Service | 5 | M | High | [ ] |
| 5.3 | Implement Gradebook Export Service | 5 | M | High | [ ] |
| 5.4 | Implement Gradebook Controllers | 5 | M | High | [ ] |
| 5.5 | Implement Compliance Report Service | 5 | M | Medium | [ ] |
| 5.6 | Implement Institution Analytics Service | 5 | S | Medium | [ ] |
| 5.7 | Implement Data Anonymization Service | 5 | M | Medium | [ ] |
| 5.8 | Implement Dashboard Controllers | 5 | M | Medium | [ ] |
| 6.1 | Create Dockerfile & Docker Compose | 6 | M | High | [ ] |
| 6.2 | Create AWS ECS Task Definition | 6 | M | High | [ ] |
| 6.3 | Setup Database Backup & Recovery | 6 | M | High | [ ] |
| 6.4 | Setup AWS RDS PostgreSQL | 6 | M | High | [ ] |
| 6.5 | Setup AWS ElastiCache Redis | 6 | S | Medium | [ ] |
| 6.6 | Setup AWS S3 for File Storage | 6 | S | Medium | [ ] |
| 6.7 | Setup AWS Secrets Manager | 6 | S | High | [ ] |
| 6.8 | Setup CI/CD Pipeline (GitHub Actions) | 6 | L | High | [ ] |
| 6.9 | Setup Monitoring & Alerting | 6 | M | High | [ ] |
| 6.10 | Setup API Rate Limiting & CORS | 6 | S | Medium | [ ] |

---

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "description": "Database & Auth Foundation",
      "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.9"]
    },
    {
      "id": 1,
      "description": "Security & Middleware",
      "tasks": ["1.6", "1.7", "1.8", "1.10", "1.11", "1.12"]
    },
    {
      "id": 2,
      "description": "Core Entities (Phase 2)",
      "tasks": ["2.1", "2.2", "2.6", "2.10", "2.11"]
    },
    {
      "id": 3,
      "description": "Core Services & Repositories",
      "tasks": ["2.3", "2.4", "2.7", "2.8", "2.12", "2.14"]
    },
    {
      "id": 4,
      "description": "Core Controllers",
      "tasks": ["2.5", "2.9", "2.13"]
    },
    {
      "id": 5,
      "description": "Submission & Grade Entities",
      "tasks": ["3.1", "3.4"]
    },
    {
      "id": 6,
      "description": "File & AI Services",
      "tasks": ["3.2", "3.5", "3.6"]
    },
    {
      "id": 7,
      "description": "Grading Core Services",
      "tasks": ["3.3", "3.7", "3.9"]
    },
    {
      "id": 8,
      "description": "Grading & Feedback Services",
      "tasks": ["3.8", "3.10", "3.11", "3.12"]
    },
    {
      "id": 9,
      "description": "Grade Override & Controllers",
      "tasks": ["3.13", "3.14", "3.15"]
    },
    {
      "id": 10,
      "description": "Notification System",
      "tasks": ["3.16", "3.17", "3.18"]
    },
    {
      "id": 11,
      "description": "Phase 3 Migrations",
      "tasks": ["3.19"]
    },
    {
      "id": 12,
      "description": "Plagiarism Entities",
      "tasks": ["4.1", "4.2"]
    },
    {
      "id": 13,
      "description": "Plagiarism Detection Services",
      "tasks": ["4.3", "4.4", "4.5", "4.6"]
    },
    {
      "id": 14,
      "description": "Plagiarism Workflow & Detection",
      "tasks": ["4.7", "4.8", "4.9"]
    },
    {
      "id": 15,
      "description": "Plagiarism Controllers & Migrations",
      "tasks": ["4.10", "4.11"]
    },
    {
      "id": 16,
      "description": "Analytics & Reporting Services",
      "tasks": ["5.1", "5.2", "5.5", "5.6", "5.7"]
    },
    {
      "id": 17,
      "description": "Gradebook & Dashboard",
      "tasks": ["5.3", "5.4", "5.8"]
    },
    {
      "id": 18,
      "description": "Infrastructure Setup (Parallel)",
      "tasks": ["6.1", "6.4", "6.5", "6.6", "6.7"]
    },
    {
      "id": 19,
      "description": "ECS & Backup",
      "tasks": ["6.2", "6.3"]
    },
    {
      "id": 20,
      "description": "CI/CD & Monitoring",
      "tasks": ["6.8", "6.9", "6.10"]
    }
  ]
}
```

---

## Notes

### Implementation Guidance

**Phase Execution Order**: Follow phases sequentially (1 → 2 → 3 → 4-5 parallel → 6). Each phase has internal ordering constraints documented in task dependencies. Do not skip phases or defer foundational work.

**Task Dependencies**: Use the Task Dependency Graph to identify which tasks can execute in parallel within and across phases. Tasks within the same wave are independent and can be assigned to different developers or executed concurrently. Wave ordering must be respected to avoid dependency violations.

**Property-Based Testing**: Each property-based test task references a specific universal property defined in the design document. These are marked with an asterisk (*) and are optional for MVP delivery but recommended for production confidence. Property test sub-tasks should be implemented immediately after the code they test to catch correctness issues early.

**Code Coverage**: Maintain >80% test coverage throughout implementation. Unit tests should focus on edge cases, error conditions, and boundary values. Integration tests should validate end-to-end workflows (submission → grading → feedback).

**Error Handling & Resilience**: All external service calls (AI providers, Turnitin, AWS APIs) must implement exponential backoff with jitter, circuit breakers for cascading failures, and fallback mechanisms where possible (e.g., local plagiarism corpus when Turnitin unavailable).

**Database & Schema Isolation**: All granting queries must explicitly specify the grading schema. Use row-level security (RLS) policies on all tables to enforce tenant isolation. Never bypass RLS with superuser privileges in application code. Test RLS policies with cross-tenant queries to verify enforcement.

**Security & Secrets**: Never commit secrets to version control. All API keys, encryption keys, database credentials, and JWT secrets must come from environment variables or AWS Secrets Manager. Rotate secrets regularly (30-day rotation period). Use TLS 1.2+ for all external communications.

**Checkpoint Tasks**: Pause at checkpoint tasks to verify all tests pass, review code quality, and confirm acceptance criteria before proceeding to the next phase. Checkpoints are gates designed to prevent accumulation of technical debt.

**Performance Targets**: 
- Submission processing (parse + validate): < 5 seconds
- AI grading: < 60 seconds (95th percentile)
- Gradebook queries: < 2 seconds
- Plagiarism detection: < 120 seconds (async, with polling)

**Tenant Context & Multi-Tenancy**: Every request must carry tenant context (X-Tenant-ID header or JWT claim). The TenantMiddleware extracts this and sets PostgreSQL session variables for RLS evaluation. Verify tenant isolation on every resource query—never trust user-provided tenant_id without verification.

**Idempotency & Retries**: Grade creation should be idempotent (grading the same submission multiple times produces consistent results within ±2 points tolerance due to AI variance). Implement idempotency keys for critical mutations to support safe retries. Use database transactions to ensure atomic operations.

### Testing Strategy

**Unit Tests**: Test individual services and entities in isolation. Mock external dependencies (AI providers, Turnitin, S3). Focus on business logic, validation, edge cases.

**Integration Tests**: Test workflows across multiple services (submission → parsing → grading → feedback). Use a test database with schema isolation. Validate RBAC and tenant context enforcement.

**Property-Based Tests**: Generate random inputs and validate universal properties hold across input ranges. Use fast-check or similar library for JavaScript/TypeScript. Property tests are complementary to unit tests, not replacements.

**Regression Tests**: After each phase, run full test suite to ensure prior functionality remains intact.

### Deployment & Rollback

**Staging**: Deploy to staging environment before production. Run smoke tests and user acceptance testing in staging. Validate all alerts fire correctly.

**Canary Deployments**: Use blue-green or canary deployments to minimize blast radius. Route 10% of traffic to new deployment first, monitor for errors, gradually increase to 100%.

**Rollback Plan**: Maintain ability to rollback ECS task definition to prior version. Keep database migrations reversible (down scripts). Document manual rollback steps for urgent issues.

**Data Migrations**: Run schema migrations in maintenance windows if necessary. Test migration up/down cycles on staging first. Plan for zero-downtime migrations where possible (add new columns as nullable, backfill, then add constraints).

### Monitoring & Observability

**Logs**: All logs must include correlation IDs for tracing requests across services. Use structured logging (JSON format) for parse-ability. Log at DEBUG level in development, INFO in production.

**Metrics**: Track: request count, error rate, latency (p50, p95, p99), database connection pool usage, AI provider API latency, storage utilization.

**Alerts**: Fire alerts on: error rate > 5%, API latency p99 > 5s, database CPU > 80%, memory > 85%, failed AI provider calls > 3 consecutive failures.

**On-Call Runbooks**: Document troubleshooting steps for each alert. Include: typical causes, investigation steps, remediation actions.

### Compliance & Audit

**FERPA** (Family Educational Rights and Privacy Act): Student educational records are protected. Only instructors and the student can access grades. Admins can view anonymized aggregates. Audit log every access to grades.

**GDPR** (General Data Protection Regulation): Users can request data export or deletion. Implement data anonymization service. Anonymize test/development data. Delete PII on user request within 30 days.

**CCPA** (California Consumer Privacy Act): Similar to GDPR for California residents. Support opt-out and data sale prohibitions.

**Audit Trail**: Record all state-changing operations (grade creation, override, plagiarism investigation action, user role change) with actor, timestamp, action, and old/new values. Audit logs are immutable (no delete/update).

### Cost Optimization

- Use RDS reserved instances for 1-3 year savings
- Implement query optimization: indices on tenant_id, created_at, status fields
- Cache gradebook queries (5-minute cache) to reduce database load
- Use S3 Intelligent-Tiering for long-term submission archive storage
- Monitor CloudWatch costs; set budget alerts


---

## Testing & Property-Based Tests Integration

Each task with testable logic includes a reference to applicable Property-Based Tests:

| Property | Tasks | Requirement |
|----------|-------|-------------|
| **Property 1: Grade Score Valid Range** | 3.7 | 7.3, 7.4 |
| **Property 2: Confidence Score Precision** | 3.7 | 7.4 |
| **Property 3: Grade Override Preserves Original** | 3.12, 3.13 | 7.11, 13 |
| **Property 4: No Data Loss in Incremental Grading** | 3.11 | 16.1 |
| **Property 5: Plagiarism Score Monotonicity** | 4.4 | 9 |
| **Property 6: AI Content Detection Accuracy** | 4.6 | 9.3 |
| **Property 7: RBAC Enforcement** | 1.8, 2.3 | 2 |
| **Property 8: Submission Late Detection Accuracy** | 3.3 | 6.6, 12.2 |
| **Property 9: Rubric Serialization Round-Trip** | 2.11 | 21.6 |
| **Property 10: Audit Trail Immutability** | 1.5, 1.10 | 20.3, 20.1 |
| **Property 11: File Type Validation** | 3.2, 3.9 | 14.3 |
| **Property 12: Late Penalty Calculation** | 3.3 | 12.2 |

---

## Next Steps for Task Execution

1. **Start with Phase 1** (Database & Auth): 2 weeks
   - Complete all 12 tasks to establish foundation
   - Test database schema and authentication before proceeding

2. **Move to Phase 2** (Core Domains): 3 weeks
   - Build user, institution, course, assignment management
   - Implement repositories and services
   - Create CRUD controllers

3. **Phase 3** (Submission & Grading): 3.5 weeks
   - Submission handling with file support
   - AI grading orchestration and error handling
   - Notification system and real-time updates

4. **Phase 4 & 5** (Parallel): 3.5 weeks
   - Academic integrity workflows
   - Analytics and reporting

5. **Phase 6** (DevOps): 1.5 weeks
   - Containerization and deployment
   - CI/CD pipeline

---

## Monitoring Checklist During Execution

- [~] All Phase N tests pass before moving to Phase N+1
- [~] Code coverage maintains >80%
- [~] Property-based tests passing for assigned properties
- [~] RBAC guards on all endpoints
- [~] Tenant isolation verified (RLS policies active)
- [~] Error handling tested (timeouts, failures, fallbacks)
- [~] Audit logging in place for compliance
- [~] Performance benchmarks: <2s response time for gradebook queries
