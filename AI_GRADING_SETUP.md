# AI Grading Setup Instructions

## Files Created

### Core Services
- `backend/src/domain/services/ai-provider.interface.ts` - AI provider contract
- `backend/src/domain/services/ai-grading.service.ts` - Grading orchestration service
- `backend/src/infrastructure/ai/openai.provider.ts` - ChatGPT implementation

### Updated Files
- `backend/src/features/grading/grading.controller.ts` - Added AI grading endpoint
- `backend/src/features/grading/grading.module.ts` - Registered AI services

### Test Files
- `backend/test-ai-grading.js` - E2E test for AI grading

---

## Quick Start (5 minutes)

### Step 1: Set API Key

**Windows PowerShell:**
```powershell
$env:TECOpenAIAPIKey = "sk-proj-YOUR_API_KEY_HERE"
```

**Mac/Linux:**
```bash
export TECOpenAIAPIKey="sk-proj-YOUR_API_KEY_HERE"
```

**Or add to backend/.env.local:**
```
TECOpenAIAPIKey=sk-proj-YOUR_API_KEY_HERE
OPENAI_MODEL=gpt-4o
OPENAI_TEMPERATURE=0.2
```

### Step 2: Build Backend
```bash
cd backend
npm run build
```
✓ Should complete with exit code 0

### Step 3: Start Backend
```bash
npm run start
```
✓ Should start listening on port 3001

### Step 4: Test AI Grading
```bash
# In another terminal
cd backend
node test-ai-grading.js
```
✓ Should show grade with score, confidence, feedback, strengths, improvements

---

## API Usage

### Endpoint
```
POST /api/v1/grading/ai-grade
```

### Headers
```
Content-Type: application/json
X-Tenant-ID: {tenant_id}
Authorization: Bearer {token}
```

### Request Body
```json
{
  "submission_id": "uuid",
  "assignment_id": "uuid"
}
```

### Successful Response
```json
{
  "success": true,
  "data": {
    "id": "grade-uuid",
    "ai_score": 87.5,
    "confidence": 92.0,
    "feedback": "Excellent work...",
    "strengths": ["Clear writing", "Good structure"],
    "improvements": ["Add examples", "Expand conclusion"],
    "status": "AI_GRADED",
    "aiProvider": "openai",
    "processingTimeMs": 1250,
    "created_at": "2026-10-01T12:00:00Z"
  }
}
```

---

## Frontend Integration

### Add "Grade with AI" Button

In Grade Submission page, add button:
```jsx
<button onClick={handleAIGrade}>Grade with AI</button>
```

### Call AI Grading Endpoint

```javascript
async function handleAIGrade() {
  const response = await fetch('/api/v1/grading/ai-grade', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenantId,
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      submission_id: submissionId,
      assignment_id: assignmentId,
    }),
  });

  const result = await response.json();
  
  if (result.success) {
    // Display grade
    setGrade({
      score: result.data.ai_score,
      confidence: result.data.confidence,
      feedback: result.data.feedback,
      strengths: result.data.strengths,
      improvements: result.data.improvements,
    });
  } else {
    // Show error
    alert(`Error: ${result.error.message}`);
  }
}
```

---

## Troubleshooting

### Error: "API key not configured"
```
1. Verify environment variable is set:
   echo $env:TECOpenAIAPIKey  (Windows PowerShell)
   echo $TECOpenAIAPIKey      (Mac/Linux)

2. If not set, run:
   $env:TECOpenAIAPIKey = "sk-proj-..."

3. Restart backend:
   npm run start
```

### Error: "Invalid authentication (401)"
```
1. Verify API key is correct
2. Check OpenAI account has active subscription
3. Try creating new API key at https://platform.openai.com/api-keys
4. Update environment variable with new key
5. Restart backend
```

### Error: "Timeout or no response"
```
1. Check internet connection
2. Verify OpenAI API status: https://status.openai.com
3. Check backend logs for errors
4. Try again in a few seconds (transient issue)
```

### Error: "Submission not found"
```
1. Verify submission_id is correct
2. Verify submission exists in database
3. Verify assignment_id is correct
4. Check tenant_id matches
```

---

## Configuration Options

### Model Selection
Change model in `backend/.env.local`:
```
OPENAI_MODEL=gpt-4o          # Recommended (most capable)
OPENAI_MODEL=gpt-4-turbo     # Faster but less capable
OPENAI_MODEL=gpt-3.5-turbo   # Cheapest but lowest quality
```

### Temperature (Consistency)
```
OPENAI_TEMPERATURE=0.2       # Low (recommended for grading)
OPENAI_TEMPERATURE=0.5       # Medium (more varied)
OPENAI_TEMPERATURE=1.0       # High (very varied)
```

Lower temperature = more consistent grades (recommended)
Higher temperature = more creative/varied responses

### Max Tokens
In `backend/src/infrastructure/ai/openai.provider.ts`:
```typescript
private maxTokens: number = 1500; // Increase if responses truncated
```

---

## How AI Grading Works

### 1. Teacher Submits Request
- Clicks "Grade with AI" button
- Sends submission_id and assignment_id

### 2. Backend Fetches Data
- Retrieves student submission content
- Retrieves assignment description
- Retrieves assignment rubric

### 3. Format Prompt
- Creates detailed grading prompt
- Includes rubric criteria
- Includes submission content
- Includes assignment instructions

### 4. Call ChatGPT
- Sends prompt to OpenAI API
- Uses GPT-4o model
- Temperature: 0.2 (for consistency)
- Waits 1-3 seconds for response

### 5. Parse Response
- Extracts JSON from ChatGPT response
- Validates all required fields
- Checks score range (0-100)
- Checks confidence range (0-100)
- Verifies feedback ≥20 chars
- Verifies ≥1 strength
- Verifies ≥1 improvement

### 6. Create Grade Record
- Saves to database with status: AI_GRADED
- Stores original AI score
- Stores confidence
- Stores feedback, strengths, improvements
- Stores grade_details: { aiProvider, reasoning, ... }

### 7. Return to Frontend
- Shows grade with all details
- Allows teacher to accept or override
- Allows manual adjustment if needed

---

## Quality Guarantees

### ✅ Confidence Score
- Always 0-100
- Two decimal places
- Validated on every grade
- Stored in database

### ✅ Feedback
- Always provided (>20 chars)
- Addresses rubric criteria
- Actionable and specific
- Stored in grade.feedback field

### ✅ Strengths & Improvements
- Always ≥1 each
- Specific to submission
- Actionable suggestions
- Stored as arrays

### ✅ Human Override
- Teachers can override any AI grade
- Original AI score preserved
- Rationale captured
- Audit trail maintained

---

## Security

### API Key
- Loaded from environment variable `TECOpenAIAPIKey`
- Never hardcoded in source code
- Never logged in responses
- Never exposed to frontend

### Data Privacy
- Student submissions sent to OpenAI
- Review your institution's data policy
- Consider: Can student data be sent externally?
- For sensitive data: Use local/private models

### Rate Limiting
- Implement per-institution limits
- Monitor API costs
- Alert on unusual usage

---

## Cost Management

### Pricing (as of October 2024)
- GPT-4o: ~$0.03 per grade (typical)
- GPT-4-turbo: ~$0.02 per grade
- GPT-3.5-turbo: ~$0.001 per grade

### Cost Optimization
1. Use gpt-4o for full essays
2. Use gpt-3.5-turbo for short answers
3. Cache rubrics to reduce prompt size
4. Batch grade similar assignments

### Monitor Usage
```javascript
// In response.data:
{
  processingTimeMs: 1250,
  aiProvider: "openai",
  // Token usage would be logged
}
```

---

## Testing Checklist

- [ ] API key set and verified
- [ ] Backend builds successfully
- [ ] Backend starts without errors
- [ ] test-ai-grading.js runs successfully
- [ ] Grade returned with score (0-100)
- [ ] Confidence returned (0-100)
- [ ] Feedback present and >20 chars
- [ ] Strengths array has ≥1 item
- [ ] Improvements array has ≥1 item
- [ ] Status is "AI_GRADED"
- [ ] Grade saved to database
- [ ] Override endpoint works

---

## Next: Frontend Implementation

After AI grading backend is working:

1. Add "Grade with AI" button to Grade Submission page
2. Call POST /api/v1/grading/ai-grade endpoint
3. Display returned grade data
4. Allow teacher to accept or override
5. Test with real submissions

---

## Support

### Common Issues
1. Check API key is set: `echo $env:TECOpenAIAPIKey`
2. Check backend is running: `curl http://localhost:3001`
3. Check database connectivity
4. Check OpenAI API status: https://status.openai.com
5. Review backend logs: `npm run start` output

### Debug Mode
Enable detailed logging in `openai.provider.ts`:
```typescript
private logger = new Logger(OpenAIProvider.name);
// Already using this.logger.debug() in code
```

To see debug logs, ensure NODE_ENV=development in .env.local

---

## You're All Set! 🚀

AI grading is ready to use. Just:
1. Set API key
2. Start backend
3. Test with `node test-ai-grading.js`
4. Integrate frontend button
5. Grade with AI!
