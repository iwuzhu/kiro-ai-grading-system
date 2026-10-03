# Testing Database Seeding End-to-End

## Quick Start
```bash
cd backend
npm run build
npm run start
```

## Expected Output in Logs
```
[DatabaseInitializationService] Verifying database connection (attempt 1/5)...
[DatabaseInitializationService] ✓ Database connection verified
[DatabaseInitializationService] Creating grading schema...
[DatabaseInitializationService] ✓ Grading schema ready
[DatabaseInitializationService] Schema synchronization disabled (use migrations instead)
[DatabaseInitializationService] Seeding database with test data...
[DatabaseInitializationService] ✓ Institution "Test University" already exists
[DatabaseInitializationService] Creating test user: admin@deepgrader.com (ADMIN)...
[DatabaseInitializationService] ✓ Created user: admin@deepgrader.com
[DatabaseInitializationService] Creating test user: teacher1@deepgrader.com (INSTRUCTOR)...
[DatabaseInitializationService] ✓ Created user: teacher1@deepgrader.com
[DatabaseInitializationService] Creating test user: student1@deepgrader.com (STUDENT)...
[DatabaseInitializationService] ✓ Created user: student1@deepgrader.com
[DatabaseInitializationService] Creating test course: CS101 - Introduction to Computer Science...
[DatabaseInitializationService] ✓ Created course: CS101
...
[DatabaseInitializationService] ✓ Test data seeding complete
```

## Test 1: Database Verification
```bash
# In a separate terminal, verify users exist
node backend/verify-seeding.js
```

Expected output:
```
✅ Institution found: Test University (550e8400-e29b-41d4-a716-446655440000)
   Tenant ID: 550e8400-e29b-41d4-a716-446655440000

✅ Found 3 users:
   • admin@deepgrader.com (ADMIN) - ACTIVE
   • teacher1@deepgrader.com (INSTRUCTOR) - ACTIVE
   • student1@deepgrader.com (STUDENT) - ACTIVE

✅ All test users created successfully!
```

## Test 2: Login API Test
```bash
# Test admin login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@deepgrader.com",
    "password": "Password123!"
  }'
```

Expected response (200 OK):
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc...",
    "user": {
      "id": "uuid",
      "email": "admin@deepgrader.com",
      "name": "Administrator",
      "role": "ADMIN"
    }
  },
  "error": null
}
```

## Test 3: Verify Password Hashing
```bash
# Query database to check password hashes exist
psql -h tec-bridgeaidb.csvikosmym65.us-east-1.rds.amazonaws.com \
     -U tecbridgeai \
     -d tec-bridgeaidb \
     -c "SELECT email, LENGTH(password_hash) as hash_length FROM grading.users WHERE tenant_id='550e8400-e29b-41d4-a716-446655440000';"
```

Expected output:
```
          email           | hash_length
-------------------------+-------------
 admin@deepgrader.com    |          60
 teacher1@deepgrader.com |          60
 student1@deepgrader.com |          60
```

## Test 4: All Test Users
```bash
# Test instructor login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher1@deepgrader.com",
    "password": "Password123!"
  }'

# Test student login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student1@deepgrader.com",
    "password": "Password123!"
  }'
```

## Troubleshooting

### Problem: Users not created
Check backend logs for:
- "Database seeding failed" = Error during seedTestData()
- Look at the error message to identify which step failed

### Problem: Institution already exists error
This is normal - the service handles this gracefully
- First run: Creates institution
- Subsequent runs: Finds and reuses existing institution

### Problem: Database connection failed
Check:
- AWS RDS is running: `aws rds describe-db-instances --region us-east-1`
- Database credentials in `.env.local`
- Network connectivity to RDS endpoint
- Security group allows port 5432

### Problem: Password hashes are NULL
This indicates users were created but password wasn't set
- Check bcrypt is installed: `npm ls bcrypt`
- Verify password hashing in createTestUsers() is working
- Look for errors in "Creating test user:" logs

## Database Direct Query
```sql
-- Connect to database
psql -h tec-bridgeaidb.csvikosmym65.us-east-1.rds.amazonaws.com \
     -U tecbridgeai \
     -d tec-bridgeaidb

-- List all institutions
SELECT id, name, domain, tenant_id FROM grading.institutions;

-- List all users
SELECT id, email, role, status, created_at FROM grading.users ORDER BY created_at DESC;

-- List all courses
SELECT id, code, title FROM grading.courses ORDER BY created_at DESC;

-- List course enrollments
SELECT u.email, c.code, ce.role FROM grading.course_enrollments ce
  JOIN grading.users u ON ce.user_id = u.id
  JOIN grading.courses c ON ce.course_id = c.id
  ORDER BY c.code, u.email;
```

## Expected Database State After Seeding

### Institutions
| id | name | domain | tenant_id |
|----|------|--------|-----------|
| 550e8400-e29b-41d4-a716-446655440000 | Test University | test-university.edu | 550e8400-e29b-41d4-a716-446655440000 |

### Users (3 total)
| email | role | status |
|-------|------|--------|
| admin@deepgrader.com | ADMIN | ACTIVE |
| teacher1@deepgrader.com | INSTRUCTOR | ACTIVE |
| student1@deepgrader.com | STUDENT | ACTIVE |

### Courses (3 total)
| code | title |
|------|-------|
| CS101 | Introduction to Computer Science |
| CS201 | Data Structures and Algorithms |
| CS301 | Web Development |

### Course Enrollments (6 total: 2 teachers × 3 courses + 1 student × 3 courses)
| User | Course | Role |
|------|--------|------|
| teacher1@deepgrader.com | CS101 | INSTRUCTOR |
| student1@deepgrader.com | CS101 | STUDENT |
| teacher1@deepgrader.com | CS201 | INSTRUCTOR |
| student1@deepgrader.com | CS201 | STUDENT |
| teacher1@deepgrader.com | CS301 | INSTRUCTOR |
| student1@deepgrader.com | CS301 | STUDENT |

## Success Criteria
✅ Backend starts without errors
✅ Seeding logs show all users created
✅ Database queries show 3 users with correct roles
✅ All users have password hashes
✅ Login API returns 200 OK with access token
✅ All 3 test users can login with password 'Password123!'
