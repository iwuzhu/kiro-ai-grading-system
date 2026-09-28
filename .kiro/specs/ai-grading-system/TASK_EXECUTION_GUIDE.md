# Task Execution Guide - AI Grading System

## Quick Start

1. **Open tasks.md**: Review the complete task list
2. **Start Phase 1**: Begin with database schema and authentication (tasks 1.1-1.12)
3. **Click "Start task"**: Use Kiro UI to begin any task
4. **Mark Complete**: Check off tasks as you complete them

---

## Task Selection by Role

### Full-Stack Developer (All Tasks)
- **Start with**: 1.1 (Database Schema)
- **Focus on**: Backend services and infrastructure
- **Pairs well with**: Database tasks first, then services, then controllers

### Backend Developer (API/Services)
- **Start with**: 1.6 (JWT Authentication)
- **Skip**: 6.1-6.10 (DevOps tasks)
- **Focus on**: Services, repositories, business logic
- **Timeline**: ~10 weeks

### Frontend Developer (Next.js)
- **Dependency**: Wait for Phase 2 controllers (task 2.5)
- **Focus on**: Dashboard, gradebook, student portal
- **Implementation path**: Fetch from backend API

### DevOps Engineer
- **Start with**: 6.1 (Docker)
- **Prerequisites**: All backend code should be complete
- **Focus on**: Infrastructure, CI/CD, monitoring
- **Parallel with**: Phase 5 analytics if time permits

---

## Critical Path (Minimum Timeline)

**Week 1-2: Phase 1 Foundation**
- [ ] 1.1-1.5: Database schema (3 days)
- [ ] 1.6-1.8: Authentication (2 days)
- [ ] 1.9-1.12: Configuration & security (2 days)

**Week 3-5: Phase 2 Core Domains**
- [ ] 2.1-2.5: User management (3 days)
- [ ] 2.6-2.9: Course management (2 days)
- [ ] 2.10-2.14: Assignment & rubrics (3 days)

**Week 6-9: Phase 3 Submission & Grading**
- [ ] 3.1-3.6: Submissions & AI providers (3 days)
- [ ] 3.7-3.11: Grading engine (4 days)
- [ ] 3.12-3.18: Overrides & notifications (3 days)

**Week 10-11: Phases 4-5 (Parallel)**
- [ ] 4.1-4.11: Plagiarism detection (5 days)
- [ ] 5.1-5.8: Analytics & reporting (4 days)

**Week 12-13: Phase 6 Deployment**
- [ ] 6.1-6.10: DevOps & CI/CD (5 days)

---

## Common Task Patterns

### Pattern: Entity + Repository + Service + Controller

**Example: User Management**
- Task 2.1: Entity & Repository (store data)
- Task 2.3: Service (business logic)
- Task 2.5: Controller (REST endpoint)

**Steps**:
1. Create TypeORM entity with decorators
2. Create repository interface and implementation
3. Write service with business logic
4. Create controller with RBAC guards
5. Test all layers

### Pattern: External Service Integration

**Example: AI Grading**
- Task 3.5: AI Provider Factory (pluggable providers)
- Task 3.6: Prompt Construction (request building)
- Task 3.7: Grading Engine (orchestration)

**Steps**:
1. Define interface (contract)
2. Implement each provider
3. Create factory to select provider
4. Wrap with error handling and retry logic
5. Add timeout management

### Pattern: Data Processing Pipeline

**Example: Plagiarism Detection**
- Task 4.3: Turnitin Integration (primary method)
- Task 4.4: Local Corpus (fallback)
- Task 4.5: Scanning Service (orchestration)
- Task 4.9: Three-Method Detection (aggregation)

**Steps**:
1. Implement primary method (API)
2. Implement fallback method (local)
3. Create orchestrator with error handling
4. Add result aggregation logic
5. Test resilience and fallbacks

---

## Dependency Resolution

### If 1.1 Is Blocked
- Cannot proceed with 1.2, 1.3, 1.4, 1.5, 2.x tasks
- **Workaround**: Use in-memory database for early development

### If 3.5 (AI Provider) Blocked
- Cannot proceed with 3.7, 3.8
- **Workaround**: Mock AI provider for testing

### If 6.4 (RDS) Blocked
- Cannot proceed with Phase 6 deployment
- **Workaround**: Use local PostgreSQL, deploy later

---

## Testing Strategy During Execution

### During Each Task
- [ ] Write unit tests for every service method
- [ ] Mock external dependencies
- [ ] Test error cases and edge conditions
- [ ] Test RBAC guards on controllers

### After Each Phase
- [ ] Run `npm run test` (>80% coverage required)
- [ ] Run integration tests: `npm run test:integration`
- [ ] Run property-based tests: `npm run test:property`
- [ ] Check TypeORM migrations: `npm run typeorm migration:show`

### Before Moving to Next Phase
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] RBAC guards verified on all endpoints
- [ ] Tenant isolation verified (RLS policies active)

---

## Property-Based Test Mapping

When implementing specific tasks, ensure associated property tests are written:

| Task | Property | Implementation |
|------|----------|-----------------|
| 3.7 | Property 1: Grade Score Valid Range | Verify 0-100, 2 decimals |
| 3.7 | Property 2: Confidence Score Precision | Verify 0-100, 2 decimals |
| 3.12-3.13 | Property 3: Override Preserves Original | Verify audit trail |
| 3.11 | Property 4: Incremental Preservation | All grades retained |
| 4.4 | Property 5: Plagiarism Monotonicity | Local corpus match |
| 4.6 | Property 6: AI Detection Accuracy | TPR > 80%, FPR < 10% |
| 1.8, 2.3 | Property 7: RBAC Enforcement | Users can't cross boundaries |
| 3.3 | Property 8: Late Detection | Flags correct, penalties applied |
| 2.11 | Property 9: Rubric Round-Trip | Parse → serialize → parse |
| 1.5, 1.10 | Property 10: Audit Immutability | Can't delete/modify logs |
| 3.2, 3.9 | Property 11: File Validation | Unsupported types rejected |
| 3.3 | Property 12: Late Penalty Calc | Formula correct |

---

## Performance Benchmarks

Before Phase 6 deployment, verify:

- [ ] **Gradebook query**: <2 seconds for 500 students
- [ ] **AI grading**: 95% within 60 seconds
- [ ] **Plagiarism scan**: 95% within 120 seconds
- [ ] **Login**: <500ms
- [ ] **Grade override**: <1 second
- [ ] **Notification delivery**: <5 seconds

---

## Troubleshooting Common Issues

### "Cannot connect to database"
- Check DATABASE_URL in .env
- Verify PostgreSQL running: `docker-compose up postgres`
- Check RLS policies enabled: `SELECT * FROM pg_policies;`

### "JWT validation failed"
- Check JWT_SECRET in .env
- Verify token not expired (1 hour expiration)
- Check tenant_id in token matches request context

### "Tenant isolation violation"
- Verify RLS policy active: `ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;`
- Check app.current_tenant_id set in middleware
- Verify PostgreSQL session variable: `SHOW app.current_tenant_id;`

### "AI provider timeout"
- Check API key valid: `curl https://api.openai.com/v1/models`
- Increase timeout if networks slow (>60s for code)
- Implement exponential backoff in retry logic

### "Tests failing after database changes"
- Run migrations: `npm run typeorm migration:run`
- Clear cache: `npm run cache:clear`
- Re-seed test data: `npm run db:seed`

---

## Code Review Checklist

For each task completion, verify:

- [ ] TypeScript compiles without errors
- [ ] All tests passing (unit + integration)
- [ ] Code follows project conventions
- [ ] RBAC guards on all POST/PATCH/DELETE endpoints
- [ ] Tenant_id explicitly filtered in queries
- [ ] Error handling covers: timeout, API failure, validation error
- [ ] Sensitive data not logged or exposed in errors
- [ ] Audit logging for significant actions
- [ ] Documentation updated (README, API docs)
- [ ] Migration scripts tested (up/down reversible)

---

## Task Kickoff Command

```bash
# Phase 1 start
npm run typeorm migration:generate -- src/infrastructure/database/migrations/CreateGradingSchema

# Phase 2 start (after 1.12 complete)
npm run typeorm migration:generate -- src/infrastructure/database/migrations/CreateUsers

# Testing
npm run test
npm run test:coverage
npm run test:property

# Linting
npm run lint
npm run format

# Build
npm run build

# Start dev server
npm run start:dev

# Docker
docker-compose up -d
docker-compose logs -f api
```

---

## Success Criteria for Full Completion

- [ ] All 87 tasks marked complete
- [ ] 80%+ test coverage
- [ ] All property-based tests passing
- [ ] All requirements (1-22) mapped to tasks
- [ ] Zero TypeScript errors
- [ ] Zero security issues (OWASP compliance)
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Ready for production deployment

---

## Escalation Path

**Task Blocked?**
1. Check dependencies in tasks.md
2. Review error messages carefully
3. Consult steering documents
4. Ask team for code review
5. Escalate to tech lead if issue persists

**Behind Schedule?**
1. Identify bottleneck task
2. Check if can be parallelized
3. Request pair programming
4. Split task into smaller subtasks
5. Communicate timeline impact

---

## Reference Materials

- **Requirements**: requirements.md
- **Design**: design.md
- **Database Schema**: steering/database-schema-isolation.md
- **AI Integration**: steering/ai-integration.md
- **Plagiarism Detection**: steering/plagiarism-detection.md
- **Security & RBAC**: steering/security-rbac.md
- **Testing Properties**: steering/testing-properties.md
- **Architecture**: steering/architecture-standards.md
- **Tech Stack**: steering/tech-stack.md
