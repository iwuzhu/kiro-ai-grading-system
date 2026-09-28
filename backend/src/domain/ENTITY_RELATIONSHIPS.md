# Entity Relationships Documentation

This document describes the TypeORM entity relationships and database schema for the multi-tenant grading system.

## Entity Diagram

```
┌─────────────────────┐
│   institutions      │
│ (Tenants)          │
├─────────────────────┤
│ id (PK)            │
│ tenant_id (unique) │
│ name               │
│ domain (unique)    │
│ timezone           │
│ plagiarism_threshold
│ ai_provider        │
│ settings (JSONB)   │
└──────────┬──────────┘
           │
           │ 1:N (has many)
           │
      ┌────┴─────┬──────────────┐
      │           │              │
      ▼           ▼              ▼
┌──────────────┐ ┌──────────────┐
│    users     │ │    courses   │
├──────────────┤ ├──────────────┤
│ id (PK)      │ │ id (PK)      │
│ tenant_id    │ │ tenant_id    │
│ inst.id (FK) │ │ inst.id (FK) │
│ email        │ │ code         │
│ name         │ │ title        │
│ role         │ │ description  │
│ pwd_hash     │ │ creator_id   │◄─────┐
│ sso_provider │ │ status       │      │
│ sso_id       │ │ sem_start    │      │
│ status       │ │ sem_end      │      │
│ permissions  │ └──────┬───────┘      │
└────┬────────┘        │                │
     │                 │ 1:N            │
     │                 │                │
     │                 ▼                │
     │        ┌─────────────────┐       │
     │        │ courses         │       │
     │        │ (created by)    │───────┘
     │        └─────────────────┘
     │
     │ 1:N (enrollments)
     │
     └────────────────────────┐
                              │
                              ▼
                     ┌──────────────────────┐
                     │ course_enrollments   │
                     ├──────────────────────┤
                     │ id (PK)              │
                     │ tenant_id            │
                     │ course_id (FK)       │
                     │ user_id (FK)         │
                     │ role                 │
                     │ enrolled_at          │
                     │ unenrolled_at        │
                     └──────────────────────┘
```

## Entities and Relationships

### 1. Institution (Tenant)

**Purpose**: Represents a single organization/tenant in the multi-tenant system.

**Key Fields**:
- `id`: UUID primary key
- `tenant_id`: Logical tenant identifier (same as id for institutions)
- `domain`: Global unique domain identifier
- `timezone`: Institution's timezone for calculations
- `plagiarism_threshold`: Default plagiarism detection threshold (0-100)
- `ai_provider`: External AI service configuration
- `settings`: Flexible JSONB for institution-specific config

**Relationships**:
- 1:N with Users (one institution has many users)
- 1:N with Courses (one institution has many courses)

**Multi-Tenancy**: Each institution is a separate tenant. All data access is filtered by tenant_id.

---

### 2. User

**Purpose**: Represents a user account within an institution.

**Key Fields**:
- `id`: UUID primary key
- `tenant_id`: Tenant isolation identifier
- `institution_id`: Foreign key to institutions (cascade delete)
- `email`: Unique within tenant
- `role`: ADMIN | INSTRUCTOR | STUDENT
- `password_hash`: For local auth (optional if SSO)
- `sso_provider`: okta | azure | google (optional)
- `sso_id`: External ID from SSO provider (optional)
- `status`: ACTIVE | INACTIVE | INVITED
- `permissions`: Array of permission codes

**Constraints**:
- `UNIQUE(tenant_id, email)`: Email must be unique within tenant
- `UNIQUE(tenant_id, sso_provider, sso_id)`: SSO ID must be unique within tenant
- `CHECK (password_or_sso)`: Must have either password OR SSO (or both)

**Relationships**:
- N:1 with Institutions (many users belong to one institution)
- 1:N with Courses (user can create multiple courses)
- 1:N with CourseEnrollments (user can be enrolled in multiple courses)

**Multi-Tenancy**: Users are tenant-isolated via tenant_id field and RLS policies.

---

### 3. Course

**Purpose**: Represents an academic course within an institution.

**Key Fields**:
- `id`: UUID primary key
- `tenant_id`: Tenant isolation identifier
- `institution_id`: Foreign key to institutions (cascade delete)
- `code`: Unique within tenant (e.g., 'CS101')
- `title`: Display name
- `description`: Long-form course description
- `created_by_user_id`: Foreign key to users who created course (can be null)
- `status`: DRAFT | ACTIVE | ARCHIVED
- `semester_start`: Academic period start date
- `semester_end`: Academic period end date

**Constraints**:
- `UNIQUE(tenant_id, code)`: Course code must be unique within tenant
- `CHECK (semester_start <= semester_end)`: Dates must be valid

**Relationships**:
- N:1 with Institutions (many courses belong to one institution)
- N:1 with User (created_by) - nullable, cascade to SET NULL
- 1:N with CourseEnrollments (one course has many enrollments)

**Multi-Tenancy**: Courses are tenant-isolated via tenant_id field and RLS policies.

---

### 4. CourseEnrollment

**Purpose**: Tracks user enrollment in courses (linking users and courses).

**Key Fields**:
- `id`: UUID primary key
- `tenant_id`: Tenant isolation identifier
- `course_id`: Foreign key to courses (cascade delete)
- `user_id`: Foreign key to users (cascade delete)
- `role`: INSTRUCTOR | STUDENT
- `enrolled_at`: Enrollment timestamp
- `unenrolled_at`: Unenrollment timestamp (null = still enrolled)

**Constraints**:
- `UNIQUE(course_id, user_id)`: Cannot enroll same user twice in same course
- `CHECK (unenrolled_at >= enrolled_at)`: Unenrollment date must be after enrollment

**Relationships**:
- N:1 with Courses (many enrollments for one course)
- N:1 with User (many enrollments for one user)

**Multi-Tenancy**: Enrollments are tenant-isolated via tenant_id field and RLS policies.

---

## Foreign Key Relationships

### Cascade Delete Policy

**ON DELETE CASCADE**: When parent record is deleted, child records are also deleted.
- `institutions` → `users`: User deleted when institution deleted
- `institutions` → `courses`: Course deleted when institution deleted
- `courses` → `course_enrollments`: Enrollment deleted when course deleted
- `users` → `course_enrollments`: Enrollment deleted when user deleted

**ON DELETE SET NULL**: When parent record is deleted, foreign key is set to null.
- `courses.created_by_user_id`: Set to null when user is deleted (but course remains)

---

## Multi-Tenancy Implementation

### Tenant Isolation Mechanisms

1. **Logical Isolation via tenant_id Field**:
   - Every entity has a `tenant_id` field
   - All queries must filter by tenant_id
   - Repository methods accept tenant_id as first parameter

2. **Unique Constraints Including tenant_id**:
   - `UNIQUE(tenant_id, email)`: Email unique per tenant
   - `UNIQUE(tenant_id, code)`: Course code unique per tenant
   - `UNIQUE(course_id, user_id)`: Enrollment unique per course-user pair

3. **Row-Level Security (RLS) Policies**:
   - Automatic database-level enforcement
   - Policies check `tenant_id = grading.get_current_tenant_id()`
   - Prevents accidental cross-tenant data access

4. **Application Layer Enforcement**:
   - Middleware sets `app.current_tenant_id` context
   - Controllers verify tenant_id in path/headers
   - Services filter all queries by tenant_id

---

## Query Patterns

### Tenant-Scoped Queries

```typescript
// Find user by email within tenant
async findByEmail(tenantId: string, email: string): Promise<User> {
  return this.find({
    where: {
      tenant_id: tenantId,
      email,
    },
  });
}

// Find active enrollments in course
async findActiveByCourse(tenantId: string, courseId: string): Promise<CourseEnrollment[]> {
  return this.find({
    where: {
      tenant_id: tenantId,
      course_id: courseId,
      unenrolled_at: IsNull(),
    },
  });
}

// Find all courses in institution
async findByInstitution(tenantId: string, institutionId: string): Promise<Course[]> {
  return this.find({
    where: {
      tenant_id: tenantId,
      institution_id: institutionId,
    },
  });
}
```

### Eager Loading with Relations

```typescript
// Load user with institution and enrollments
const user = await userRepository.find({
  where: { id: userId },
  relations: ['institution', 'enrollments', 'enrollments.course'],
});

// Load course with enrollments and enrolled users
const course = await courseRepository.find({
  where: { id: courseId },
  relations: ['enrollments', 'enrollments.user', 'institution'],
});
```

---

## Indices and Performance

### Key Indices

| Table | Columns | Purpose |
|-------|---------|---------|
| institutions | tenant_id | Tenant isolation lookups |
| institutions | domain | Domain-based routing |
| users | tenant_id | Tenant isolation |
| users | tenant_id, email | Email lookup within tenant |
| users | role | Query users by role |
| users | status | Query users by status |
| courses | tenant_id | Tenant isolation |
| courses | tenant_id, code | Course code lookup within tenant |
| courses | status | Query courses by status |
| course_enrollments | tenant_id | Tenant isolation |
| course_enrollments | course_id | Find enrollments for course |
| course_enrollments | user_id | Find enrollments for user |
| course_enrollments | (course_id, user_id) WHERE unenrolled_at IS NULL | Active enrollments |

---

## Soft Delete Pattern

All entities support soft deletes via `deleted_at` field:

```typescript
// Soft delete (records remain in database)
user.deleted_at = new Date();
await userRepository.save(user);

// Query excludes soft-deleted records by default
const activeUsers = await userRepository.find({
  where: {
    tenant_id: tenantId,
    deleted_at: IsNull(),
  },
});

// Restore soft-deleted record
user.deleted_at = null;
await userRepository.save(user);
```

---

## Audit Trail

All entities have audit timestamps:
- `created_at`: Set to NOW() on insert
- `updated_at`: Automatically updated to NOW() on any modification via trigger
- `deleted_at`: Set when soft-deleted

---

## Constraints and Validation

### Data Integrity Constraints

1. **Plagiarism Threshold**:
   ```sql
   CHECK (plagiarism_threshold >= 0 AND plagiarism_threshold <= 100)
   ```

2. **AI Provider**:
   ```sql
   CHECK (ai_provider IN ('openai', 'claude', 'bedrock'))
   ```

3. **Timezone Format**:
   ```sql
   CHECK (timezone ~ '^[A-Za-z/_]+$')
   ```

4. **Email Format**:
   ```sql
   CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$')
   ```

5. **Semester Dates**:
   ```sql
   CHECK (semester_start IS NULL OR semester_end IS NULL OR semester_start <= semester_end)
   ```

6. **Enrollment Dates**:
   ```sql
   CHECK (unenrolled_at IS NULL OR unenrolled_at >= enrolled_at)
   ```

---

## Cascade Behaviors

### Institution Deletion
- Users in institution → DELETED
- Courses in institution → DELETED
- Enrollments in those courses → DELETED

### User Deletion
- Courses created by user → PRESERVED (created_by_user_id set to NULL)
- Enrollments for user → DELETED

### Course Deletion
- Enrollments in course → DELETED
- (Assignments, submissions, etc. in future migrations)

---

## Migration Order

1. **Migration 1**: Create grading schema (Task 1.1 - COMPLETED)
2. **Migration 2**: Create base domain entities (Task 1.2 - THIS TASK)
   - institutions
   - users
   - courses
   - course_enrollments
3. **Future Migrations**: Additional entities (assignments, submissions, grades, etc.)
