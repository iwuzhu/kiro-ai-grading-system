# Database Setup Instructions

This document provides step-by-step instructions for developers to set up the AI Grading System database with the grading schema.

---

## Prerequisites

### Required Software

- **PostgreSQL 12+** (recommended: 15 or later)
  - Download: https://www.postgresql.org/download/
  - Verify: `psql --version`

- **Node.js 18+**
  - Download: https://nodejs.org/
  - Verify: `node --version`

- **npm or yarn**
  - Comes with Node.js
  - Verify: `npm --version`

### Environment Setup

Ensure these tools are in your PATH:
- `psql` (PostgreSQL client)
- `pg_dump` (PostgreSQL backup utility)
- `npm` or `yarn`

---

## Step 1: Start PostgreSQL

### Option A: Local PostgreSQL Installation

```bash
# macOS (with Homebrew)
brew services start postgresql

# Linux (Ubuntu/Debian)
sudo systemctl start postgresql

# Windows
# PostgreSQL starts automatically; check via Services panel

# Verify PostgreSQL is running
psql -U postgres -c "SELECT 1"
```

### Option B: Docker PostgreSQL

```bash
# Pull PostgreSQL 15 image
docker pull postgres:15

# Run PostgreSQL container
docker run -d \
  --name postgres-grading \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=shared_database \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15

# Verify container is running
docker ps | grep postgres-grading

# Verify database is accessible
psql -h localhost -U postgres -c "SELECT 1"
```

---

## Step 2: Create the Shared Database

```bash
# Connect to PostgreSQL as superuser
psql -U postgres -h localhost

# Create the shared database
CREATE DATABASE shared_database OWNER postgres;

# Exit psql
\q

# Verify database exists
psql -U postgres -h localhost -d shared_database -c "SELECT 1"
```

---

## Step 3: Create Application User

```bash
# Connect to PostgreSQL as superuser
psql -U postgres -h localhost

# Create application user
CREATE USER grading_user WITH PASSWORD 'change_me_in_production';

# Grant basic permissions
GRANT CONNECT ON DATABASE shared_database TO grading_user;

# Exit psql
\q
```

---

## Step 4: Configure Environment Variables

### Create `.env.local` or `.env.development`

```bash
# From backend directory
cat > .env.local << 'EOF'
# Database Connection
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=grading_user
DB_PASSWORD=change_me_in_production
DB_NAME=shared_database

# Connection Pool
DB_POOL_MAX=20
DB_POOL_MIN=5
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=5000

# Logging
DB_LOGGING=true
NODE_ENV=development

# SSL (disable for local development)
DB_SSL=false
EOF
```

**Note:** Never commit `.env.local` to git. It's in `.gitignore`.

---

## Step 5: Install Dependencies

```bash
# From backend directory
npm install

# or with yarn
yarn install

# Verify dependencies installed
npm list typeorm @nestjs/typeorm pg
```

---

## Step 6: Run Database Migrations

### Check Migration Status

```bash
# List all migrations and their status
npm run typeorm migration:show

# Output will show pending and executed migrations
```

### Run All Pending Migrations

```bash
# Run migrations in order
npm run typeorm migration:run

# You should see output like:
# ✔ CreateGradingSchema1704067200000
# query: CREATE SCHEMA IF NOT EXISTS grading
# query: GRANT USAGE ON SCHEMA grading TO application_role
# ...
```

### Verify Schema Created

```bash
# Connect to the database
psql -U grading_user -h localhost -d shared_database

# List all schemas
\dn

# Expected output should include 'grading' schema:
#  List of schemas
#    Name   | Owner 
# ---------+-------
#  grading | postgres
#  public  | postgres

# Exit psql
\q
```

---

## Step 7: Verify RLS Functions

```bash
# Connect as application user
psql -U grading_user -h localhost -d shared_database

# List all functions in grading schema
\df grading.*

# Expected output:
#                    List of functions
#  Schema | Name                  | Result data type | Type
# --------+-----------------------+------------------+------
#  grading | check_tenant_access   | boolean          | func
#  grading | get_current_tenant_id | uuid             | func
#  grading | get_current_user_id   | uuid             | func
#  grading | get_current_user_role | text             | func

# Test get_current_tenant_id() function
SELECT grading.get_current_tenant_id();

# Should return NULL (no context set)
# (1 row)
# NULL

# Exit psql
\q
```

---

## Step 8: Verify Application Role Permissions

```bash
# Connect as superuser
psql -U postgres -h localhost -d shared_database

# Check application_role permissions on grading schema
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'grading' AND grantee = 'application_role';

# Should show: application_role has USAGE, CREATE, SELECT, INSERT, UPDATE, DELETE

# Exit psql
\q
```

---

## Step 9: Start the Application

### Development Mode

```bash
# From backend directory
npm run start:dev

# Application starts on http://localhost:3000
# TypeORM logs database queries in development mode
```

### Production Mode

```bash
# Build application
npm run build

# Start application
npm run start:prod

# Application starts on http://localhost:3000
# No TypeORM logging in production mode
```

---

## Troubleshooting

### PostgreSQL Connection Error

**Error**: `connect ECONNREFUSED 127.0.0.1:5432`

**Solutions**:
1. Verify PostgreSQL is running: `psql -U postgres -c "SELECT 1"`
2. Check DB_HOST in `.env.local` (should be `localhost` for local dev)
3. Check DB_PORT in `.env.local` (default is 5432)
4. If using Docker: `docker ps | grep postgres` to verify container is running

### Authentication Error

**Error**: `password authentication failed for user "grading_user"`

**Solutions**:
1. Verify password in `.env.local` matches the user password
2. Reset password: `psql -U postgres -c "ALTER USER grading_user WITH PASSWORD 'new_password'"`
3. Update `.env.local` with new password

### Permission Denied on Grading Schema

**Error**: `permission denied for schema grading`

**Solutions**:
1. Verify application_role has grants: 
   ```bash
   psql -U postgres -h localhost -d shared_database -c \
     "GRANT USAGE, CREATE ON SCHEMA grading TO application_role;"
   ```
2. Re-run migrations: `npm run typeorm migration:run`

### Migration Already Executed

**Error**: `QueryFailedError: relation "grading" already exists`

**Solution**: This is not an error. TypeORM tracks which migrations have run. To verify:
```bash
npm run typeorm migration:show
# Should show all migrations as executed (✔)
```

### "Cannot find module 'typeorm'" Error

**Error**: `Error: Cannot find module 'typeorm'`

**Solutions**:
1. Run `npm install` to install dependencies
2. Verify TypeORM is installed: `npm list typeorm`
3. Check you're in the backend directory: `pwd` should show `backend` folder

---

## Common Database Tasks

### Create Test Data

```bash
# Connect to database
psql -U grading_user -h localhost -d shared_database

-- Set tenant context for testing
SET app.current_tenant_id = '550e8400-e29b-41d4-a716-446655440000';

-- Insert test institution (once institutions table is created)
-- INSERT INTO grading.institutions (tenant_id, name) 
-- VALUES (current_setting('app.current_tenant_id')::uuid, 'Test Institution');

\q
```

### Backup Grading Schema

```bash
# Backup only grading schema
pg_dump -U grading_user -h localhost \
  -n grading \
  shared_database > grading_backup_$(date +%Y%m%d_%H%M%S).sql

echo "Backup created: grading_backup_$(date +%Y%m%d_%H%M%S).sql"
```

### Restore Grading Schema

```bash
# Restore grading schema from backup
psql -U grading_user -h localhost \
  shared_database < grading_backup_20240101_120000.sql

echo "Restore complete"
```

### Reset Database (Development Only)

```bash
# WARNING: This deletes all data in grading schema
# Do NOT run in production

# Connect as superuser
psql -U postgres -h localhost -d shared_database

-- Drop and recreate grading schema
DROP SCHEMA IF EXISTS grading CASCADE;
\q

# Re-run migrations to recreate empty schema
npm run typeorm migration:run
```

---

## Environment-Specific Configuration

### Local Development

```bash
# .env.local
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=grading_user
DB_PASSWORD=change_me
DB_LOGGING=true
NODE_ENV=development
DB_SSL=false
```

### Staging/Production

```bash
# .env.production
DB_HOST=postgres.example.com
DB_PORT=5432
DB_USERNAME=grading_user_prod
DB_PASSWORD=strong_secure_password
DB_LOGGING=false
NODE_ENV=production
DB_SSL=true
DB_POOL_MAX=50
DB_POOL_MIN=10
```

**Note:** Never commit production credentials. Use environment variables or secrets management.

---

## Next Steps

1. ✅ Database schema created (Task 1.1)
2. ⬜ Create domain entities and tables (Task 1.2)
3. ⬜ Create indices (Task 1.3)
4. ⬜ Create audit logging tables (Task 1.4)
5. ⬜ Create RLS policies (Task 1.5)
6. ⬜ Create authentication system (Task 1.6)

---

## Support & Resources

- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **TypeORM Documentation**: https://typeorm.io/
- **NestJS Database Documentation**: https://docs.nestjs.com/techniques/database
- **Schema Design Guide**: See `src/infrastructure/database/SCHEMA_SETUP.md`
- **Steering Document**: See `.kiro/steering/database-schema-isolation.md`

---

## Questions?

Refer to the troubleshooting section above or check the schema setup documentation:
```bash
# From backend directory
cat src/infrastructure/database/SCHEMA_SETUP.md
```
