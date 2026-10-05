# AI Grade Button - Quick Start Guide

## What We Built

✨ **New Feature:** "🤖 AI Grade" button on the Grade Submission page

### Location
- **URL:** `/dashboard/instructor/courses/{courseId}/assignments/{assignmentId}/submissions/{submissionId}/grade`
- **Button Position:** Next to "⬇️ Download File" button
- **Color:** Purple (🤖 AI Grade)

### What It Does
1. Clicks button → Sends submission to AI (OpenAI GPT-4o)
2. AI analyzes submission against assignment rubric
3. AI generates: Score, Feedback, Strengths, Areas for Improvement
4. Frontend auto-fills these fields
5. Instructor can review and override
6. Click "Save Grade" to persist to database

## File Changes

| File | Status | What Changed |
|------|--------|--------------|
| `frontend/src/hooks/useAIGrade.ts` | ✅ NEW | React hook for AI grading API calls |
| `frontend/src/components/common/SubmissionViewer.tsx` | ✅ UPDATED | Added AI Grade button |
| `frontend/src/app/dashboard/instructor/.../grade/page.tsx` | ✅ UPDATED | Integrated useAIGrade hook + handlers |
| `backend/test-ai-grade-frontend-integration.js` | ✅ NEW | Test script for full flow |
| Frontend build | ✅ SUCCESS | No errors, exit code 0 |

## Testing Locally

### Step 1: Start Backend (if not running)
```bash
cd backend
npm start
# Should listen on http://localhost:3001
```

### Step 2: Run Integration Test
```bash
node backend/test-ai-grade-frontend-integration.js
```

Expected output:
```
🧪 AI Grade Frontend Integration Test
Step 1️⃣: Generate JWT Token
✅ JWT Token Generated: eyJhbGci...
Step 2️⃣: Call AI Grading Endpoint
📊 HTTP Status: 201 Created
...
```

### Step 3: Start Frontend (Development)
```bash
cd frontend
npm run dev
# Open http://localhost:3000
```

### Step 4: Test in Browser
1. Login as Instructor
2. Go to an assignment with submissions
3. Click "View Submissions"
4. Click on a student submission
5. Click "Grade Submission"
6. Click the **"🤖 AI Grade"** button
7. Wait 2-3 seconds for AI response
8. See form fields auto-populated
9. Optionally override values
10. Click "Save Grade"

## API Endpoint Reference

### Generate AI Grade
```
POST /api/v1/grading/ai-grade
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "submission_id": "uuid",
  "assignment_id": "uuid"
}
```

**Success Response (201):**
```json
{
  "ai_score": 85,
  "confidence": 92,
  "feedback": "Excellent analysis...",
  "strengths": ["Clear", "Well-structured"],
  "improvements": ["Add examples", "Improve formatting"],
  "aiProvider": "openai",
  "processingTimeMs": 2341,
  "status": "success"
}
```

**Error Response (201 with error):**
```json
{
  "status": "error",
  "error": {
    "code": "AI_GRADING_FAILED",
    "message": "Submission not found: {id}"
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────┐
│  Frontend: Grade Submission Page            │
│  - SubmissionViewer with AI Grade button    │
│  - Form for Score/Feedback/Strengths/etc    │
└────────────┬────────────────────────────────┘
             │
             │ Click "🤖 AI Grade"
             ↓
┌─────────────────────────────────────────────┐
│  useAIGrade Hook                            │
│  - Calls POST /api/v1/grading/ai-grade      │
│  - Sends JWT token                          │
│  - Parses response                          │
└────────────┬────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────┐
│  Backend: GradingController                 │
│  - POST /api/v1/grading/ai-grade            │
│  - Validates JWT + Tenant                   │
│  - Calls AIGradingService                   │
└────────────┬────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────┐
│  AIGradingService                           │
│  - Loads submission from DB                 │
│  - Loads assignment + rubric                │
│  - Calls OpenAI API (GPT-4o)                │
│  - Parses AI response                       │
│  - Returns score + feedback                 │
└────────────┬────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────┐
│  OpenAI API (GPT-4o)                        │
│  - Receives: Submission + Rubric            │
│  - Temp: 0.2 (deterministic)                │
│  - Max Tokens: 1000                         │
│  - Returns: Grade analysis                  │
└─────────────────────────────────────────────┘
```

## Configuration

### OpenAI API Key
**Location:** `backend/.env.local`
```
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

### JWT Secret
**Location:** `backend/.env.local`
```
JWT_SECRET=e4bd51ddf172769c442b126626bea54c74be0aa7f3d4dc4de3e83a01b226ab69af42e3ff2571d3ef9838f5a04ab957efdee1c27074a7cea33eb1b50247235bfc
```

### Database Connection
**Location:** `backend/.env.local`
```
DB_HOST=tec-bridgeaidb.csvikosmym65.us-east-1.rds.amazonaws.com
DB_USER=tecbridgeai
DB_SCHEMA=grading
```

## Troubleshooting

### "🤖 AI Grade button not visible"
- Make sure you're on the Grade Submission page
- Check browser console for errors
- Verify SubmissionViewer component loaded
- Hard refresh browser (Ctrl+F5)

### "Button clicks but nothing happens"
- Check browser Network tab for API calls
- Verify JWT token is in localStorage
- Check backend logs for errors
- Ensure backend is running on :3001

### "API returns 401 Unauthorized"
- JWT token might be expired or invalid
- Check JWT_SECRET matches between frontend and backend
- Verify token has `type: 'access'` claim
- Try logging out and logging back in

### "API returns 500 Internal Server Error"
- Check backend logs for full error
- Ensure submission and assignment IDs are valid
- Verify OPENAI_API_KEY is set correctly
- Check database connection

### "Form fields don't populate"
- Check browser console for response parsing errors
- Verify API response has all required fields
- Look for error messages in form
- Check useAIGrade hook implementation

## Performance Notes

- **First AI call:** ~2-3 seconds (includes network + API latency)
- **Subsequent calls:** Also ~2-3 seconds (not cached at backend)
- **Frontend loading state:** Shows "⚙️ Grading..." during wait
- **Button disabled:** During processing to prevent double-clicks

## Security

✅ **Implemented:**
- JWT authentication required
- Tenant isolation (can only grade own submissions)
- Input validation
- Error handling doesn't leak secrets
- No API keys in frontend code

## Production Readiness

✅ **Ready for production:**
- Error handling implemented
- Loading states working
- Form validation present
- JWT authentication enforced
- Tenant isolation verified
- Build successful

⚠️ **Recommended before production:**
- Test with multiple AI providers (Claude, Bedrock)
- Monitor AI accuracy and confidence calibration
- Add retry logic with exponential backoff
- Implement caching for rubric text
- Add analytics to track AI vs. instructor grades
- Set up cost monitoring for OpenAI API

## Next Steps

1. **Deploy to staging:** Test with real data
2. **Gather feedback:** From instructors and students
3. **Monitor accuracy:** Compare AI grades with instructor grades
4. **Optimize prompts:** Refine AI prompt based on feedback
5. **Add more providers:** Support Claude, Bedrock, etc.
6. **Analytics:** Track usage and costs

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review backend logs: `backend/dist/main.js` output
3. Check frontend console: Browser DevTools → Console
4. Verify configuration: Check `.env.local` files
5. Test directly: Use `test-ai-grade-frontend-integration.js`

---

**Version:** 1.0 (Initial Release)  
**Date:** October 4, 2026  
**Status:** ✅ Complete and Tested
