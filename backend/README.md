# AI Grading System - Backend

The backend is a NestJS-based REST API that manages all grading system operations, including institutions, users, courses, assignments, submissions, grading, and plagiarism detection.

## Quick Start

### 1. Setup Database

```bash
# Read setup instructions
cat SETUP_DATABASE.md

# Or follow these quick steps:
npm install
npm run typeorm migration:run
npm run start:dev
```

### 2. Verify Schema Created

```bash
psql -U grading_user -h localhost -d shared_database -c "\dn grading"
```

### 3. Run Tests

```bash
# Run all tests
npm test

# Run specific migration tests
npm test -- migrations
```

## Project Structure

```
backend/
├── src/
│   ├── app.module.ts                          # NestJS main module
│   ├── main.ts                                # Application entry point
│   ├── domain/                                # Domain layer (business logic)
│   │   ├── institutions/
│   │   ├── users/
│   │   ├── courses/
│   │   ├── assignments/
│   │   ├── submissions/
│   │   ├── grades/
│   │   ├── plagiarism/
│   │   └── [other domains]
│   ├── infrastructure/                        # Infrastructure layer
│   │   ├── database/
│   │   │   ├── migrations/                    # TypeORM migrations
│   │   │   │   ├── 1_create_grading_schema.ts     ✅ Task 1.1
│   │   │   │   └── 1_create_grading_schema.test.ts
│   │   │   ├── database.module.ts             ✅ Task 1.1
│   │   │   └── SCHEMA_SETUP.md                ✅ Task 1.1
│   │   ├── middleware/
│   │   │   ├── tenant-context.middleware.ts   ✅ Task 1.1
│   │   │   └── [other middleware]
│   │   ├── config/
│   │   └── [other infrastructure]
│   ├── common/
│   │   ├── decorators/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── pipes/
│   └── [other feature modules]
├── test/                                      # Test files
├── dist/                                      # Compiled output
├── node_modules/                              # Dependencies
├── .env.local                                 # Local environment (git ignored)
├── .env.example                               # Environment template
├── package.json                               # Dependencies & scripts
├── tsconfig.json                              # TypeScript configuration
├── jest.config.js                             # Jest configuration
├── SETUP_DATABASE.md                          ✅ Task 1.1 - Setup guide
├── README.md                                  # This file
├── TASK_1_1_DELIVERABLES.md                   ✅ Task 1.1 - Deliverables
├── VERIFICATION_CHECKLIST.md                  ✅ Task 1.1 - Verification
└── [other root files]
```

## Key Files for Task 1.1

| File | Purpose | Type |
|------|---------|------|
| `src/infrastructure/database/migrations/1_create_grading_schema.ts` | Database schema migration | TypeORM Migration |
| `src/infrastructure/database/database.module.ts` | TypeORM configuration | NestJS Module |
| `src/infrastructure/middleware/tenant-context.middleware.ts` | Request context setup | NestJS Middleware |
| `src/infrastructure/database/SCHEMA_SETUP.md` | Schema documentation | Documentation |
| `SETUP_DATABASE.md` | Developer setup guide | Documentation |
| `TASK_1_1_DELIVERABLES.md` | Task completion summary | Documentation |
| `VERIFICATION_CHECKLIST.md` | Verification procedures | Checklist |

## Database Architecture

### Multi-Tenant Design

The system uses **schema isolation** for multi-tenancy:

```
PostgreSQL Database (shared_database)
└── grading schema
    ├── institutions
    ├── users
    ├── courses
    ├── assignments
    ├── submissions
    ├── grades
    └── [other tables]
```

**Benefits**:
- Clear separation from other projects
- Independent backup/restore
- Simpler permission management
- Easy to move to dedicated database later

### Row-Level Security (RLS)

RLS policies enforce tenant isolation at the database level:

```sql
CREATE POLICY tenant_isolation ON grading.assignments
  USING (tenant_id = grading.get_current_tenant_id())
  WITH CHECK (tenant_id = grading.get_current_tenant_id());
```

RLS Foundation Functions (created by Task 1.1):
- `get_current_tenant_id()` - Returns current tenant UUID
- `check_tenant_access(uuid)` - Validates tenant membership
- `get_current_user_id()` - Returns current user UUID
- `get_current_user_role()` - Returns user role (admin/instructor/student)

## Environment Configuration

### Development (.env.local)

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=grading_user
DB_PASSWORD=change_me
DB_NAME=shared_database
DB_LOGGING=true
NODE_ENV=development
DB_SSL=false
```

### Production

```bash
DB_HOST=postgres.example.com
DB_PORT=5432
DB_USERNAME=grading_user
DB_PASSWORD=***
DB_NAME=shared_database
DB_LOGGING=false
NODE_ENV=production
DB_SSL=true
DB_POOL_MAX=50
DB_POOL_MIN=10
```

## NPM Scripts

```bash
# Development
npm run start:dev          # Start development server with auto-reload
npm run start              # Start production server
npm run build              # Build for production

# Database
npm run typeorm migration:show     # Show migration status
npm run typeorm migration:run      # Run pending migrations
npm run typeorm migration:revert   # Revert last migration
npm run typeorm migration:generate # Generate new migration

# Testing
npm test                   # Run all tests
npm test -- migrations     # Run migration tests only
npm test -- --watch        # Run tests in watch mode
npm run test:cov           # Run tests with coverage

# Code Quality
npm run lint               # Run ESLint
npm run format             # Format code with Prettier
npm run type-check         # Run TypeScript type checking
```

## Getting Started

### Prerequisites

- PostgreSQL 12+ (recommended: 15+)
- Node.js 18+
- npm or yarn

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure Database

```bash
# Create .env.local file
cp .env.example .env.local

# Edit .env.local with your database credentials
nano .env.local
```

### Step 3: Create Database (if needed)

```bash
psql -U postgres -h localhost << EOF
CREATE DATABASE shared_database;
CREATE USER grading_user WITH PASSWORD 'change_me';
GRANT CONNECT ON DATABASE shared_database TO grading_user;
EOF
```

### Step 4: Run Migrations

```bash
npm run typeorm migration:run
```

### Step 5: Start Development Server

```bash
npm run start:dev
```

API will be available at http://localhost:3000

## API Structure

### Controllers & Routes

Controllers follow RESTful conventions:

```
GET    /api/v1/institutions              # List institutions
GET    /api/v1/institutions/:id          # Get institution
POST   /api/v1/institutions              # Create institution
PATCH  /api/v1/institutions/:id          # Update institution
DELETE /api/v1/institutions/:id          # Delete institution
```

### Middleware Pipeline

Every request goes through:

1. **HTTP Middleware**
   - Body parsing
   - CORS handling
   - Request logging

2. **Authentication Middleware** (Task 1.6)
   - JWT verification
   - User extraction

3. **Tenant Context Middleware** (Task 1.1) ✅
   - Extract tenant_id, user_id, user_role
   - Set PostgreSQL session variables
   - Enable RLS policy enforcement

4. **RBAC Guard** (Task 1.9)
   - Verify user has required role
   - Verify user has resource permissions

5. **Business Logic**
   - Service layer processes request
   - Queries include RLS filtering
   - Response returned

## Testing

### Unit Tests

Test individual functions and services:

```bash
# Run unit tests
npm test -- --testPathPattern='.service.spec.ts$'
```

### Migration Tests

Test database migrations:

```bash
# Run migration tests
npm test -- migrations

# Expected: 16+ tests passing
```

### Integration Tests

Test full request/response cycles:

```bash
# Run integration tests
npm test -- --testPathPattern='.controller.spec.ts$'
```

## Logging

### Development

Enable verbose database logging:

```env
DB_LOGGING=true
NODE_ENV=development
```

Logs show:
- All SQL queries executed
- Tenant context setup
- Middleware execution

### Production

Disable logging for performance:

```env
DB_LOGGING=false
NODE_ENV=production
```

## Common Development Tasks

### Add New Entity

1. Create entity file: `src/domain/[module]/entities/[entity].entity.ts`
2. Add `@Entity({ schema: 'grading' })` decorator
3. Register in TypeORM module
4. Create migration if needed

### Add New Migration

```bash
# Generate migration
npm run typeorm migration:generate -- -n <MigrationName>

# Migration created in src/infrastructure/database/migrations/

# Run migration
npm run typeorm migration:run
```

### Query with Tenant Context

```typescript
// In service
async getAssignments(courseId: string): Promise<Assignment[]> {
  // RLS policies automatically filter by tenant_id
  return this.assignmentRepository.find({
    where: { courseId },
  });
}

// Only returns assignments for current tenant
```

### Set Tenant Context (Development)

For testing without authentication:

```bash
# Include in request headers or body
X-Tenant-ID: 550e8400-e29b-41d4-a716-446655440000
```

Or in request body:

```json
{
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "660e8400-e29b-41d4-a716-446655440000",
  "userRole": "admin"
}
```

## Troubleshooting

### PostgreSQL Connection Failed

```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT 1"

# Check .env.local credentials
cat .env.local

# Verify database exists
psql -U postgres -c "CREATE DATABASE shared_database;"
```

### Migration Failed

```bash
# Check migration status
npm run typeorm migration:show

# View migration file
cat src/infrastructure/database/migrations/1_create_grading_schema.ts

# Re-run migration
npm run typeorm migration:run
```

### Tests Failing

```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test
npm test -- migrations --testNamePattern="schema creation"

# Check database is accessible
psql -U grading_user -h localhost -d shared_database -c "\dn grading"
```

## Documentation

### Task 1.1 Deliverables

- ✅ **TASK_1_1_DELIVERABLES.md**: Complete task summary and deliverables
- ✅ **SETUP_DATABASE.md**: Step-by-step setup instructions
- ✅ **VERIFICATION_CHECKLIST.md**: Verification procedures
- ✅ **src/infrastructure/database/SCHEMA_SETUP.md**: Schema architecture and operations

### Related Documentation

- **Requirements**: `../.kiro/specs/ai-grading-system/requirements.md`
- **Design**: `../.kiro/specs/ai-grading-system/design.md`
- **Steering**: `../.kiro/steering/database-schema-isolation.md`

## Architecture Layers

### Domain Layer (`src/domain/`)
- Business logic for each domain
- TypeORM entities
- Repository interfaces
- Use case services

### Application Layer (`src/application/`)
- Controllers and routes
- DTOs and validation
- Orchestration between domains
- Response formatting

### Infrastructure Layer (`src/infrastructure/`)
- Database configuration and migrations
- Authentication and middleware
- External service integrations
- Logging and monitoring

### Common Layer (`src/common/`)
- Shared decorators
- Guards and interceptors
- Exception filters
- Utilities and helpers

## Security

### Tenant Isolation

Every query is automatically scoped to the current tenant via RLS:

```sql
-- RLS policy prevents cross-tenant data access
SELECT * FROM grading.assignments
-- Only returns assignments where tenant_id = current_tenant_id
```

### Role-Based Access Control

Routes protected by role guards:

```typescript
@UseGuards(RoleGuard)
@Roles(Role.ADMIN, Role.INSTRUCTOR)
@Post('/assignments')
createAssignment(@Body() dto: CreateAssignmentDto) {
  // Only admins and instructors can create assignments
}
```

### Audit Trail

All data changes logged to audit table:

```
grading.audit_logs
├── id
├── tenant_id
├── user_id
├── entity_type
├── entity_id
├── action (CREATE, UPDATE, DELETE)
├── changes (JSON)
└── created_at
```

## Performance Optimization

### Connection Pooling

```env
DB_POOL_MAX=20      # Maximum connections
DB_POOL_MIN=5       # Minimum connections
DB_IDLE_TIMEOUT=30000    # Kill idle after 30s
```

### Indices

Created by Task 1.3:
- Tenant isolation indices
- Foreign key indices
- Query optimization indices

### Caching (Task 5.x)

- Redis for session data
- Grade caching for analytics

## Next Tasks

- **Task 1.2**: Create domain entities
- **Task 1.3**: Create indices
- **Task 1.4**: Create audit logging tables
- **Task 1.5**: Create RLS policies
- **Task 1.6**: Implement authentication

## Support

- **Setup Issues**: See `SETUP_DATABASE.md`
- **Schema Issues**: See `src/infrastructure/database/SCHEMA_SETUP.md`
- **Task Summary**: See `TASK_1_1_DELIVERABLES.md`
- **Verification**: See `VERIFICATION_CHECKLIST.md`

## Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

