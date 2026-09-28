# Plagiarism Detection System

## Overview

The plagiarism detection system uses a three-method approach to provide comprehensive academic integrity monitoring while maintaining resilience and privacy:

1. **CopyLeaks API** (Primary) - Professional plagiarism detection with external source matching
2. **Local Corpus** (Fallback) - Institutional submission history matching with enhanced algorithms
3. **AI Content Detection** - Synthetic content identification as a separate metric

### Architecture

```
Submission Received
    ↓
Plagiarism Scanning Service
    ├─ Try CopyLeaks (120s timeout)
    │   ├─ Success → Return scores and sources
    │   └─ Timeout/Fail → Continue to fallback
    ├─ Try Local Corpus (30s timeout)
    ├─ Try AI Detection (30s timeout)
    └─ Combine results → Create PlagiarismResult record
```

### Key Features

- **Multi-method resilience**: Continues operating if primary service fails
- **Combined scoring**: Uses max(CopyLeaks, LocalCorpus) for plagiarism, separate AI score
- **Configurable thresholds**: Institutional policies enforce different thresholds
- **Audit trail**: Immutable records of all detection methods used
- **Privacy-focused**: Optional local-only scanning without external uploads

---

## Method 1: CopyLeaks API (Primary)

### Overview

CopyLeaks provides professional plagiarism detection with access to billions of documents including web content, academic databases, and student submissions.

### API Details

- **Base URL**: `https://api.copyleaks.com/v3`
- **Authentication**: Bearer token in `Authorization` header
- **Timeout**: 120 seconds per submission
- **Rate Limits**: Check CopyLeaks documentation for limits

### Endpoints

```
POST /submissions
  Submit document for scanning
  Request:
    {
      "document": {
        "docName": "string",
        "docText": "string"
      },
      "webhooks": { /* optional */ },
      "properties": { "custom": { "submissionId": "uuid" } }
    }
  Response: { "id": "scan-uuid", "status": "queued" }

GET /submissions/{id}
  Check submission status
  Response: { "status": "processing|completed", ... }

GET /submissions/{id}/report
  Retrieve full report with results
  Response: { 
    "statistics": { "percentMatched": 45.2, ... },
    "results": { 
      "aiScore": 12.5,
      "sources": [ { "title": "...", "percentMatched": 45.2 } ]
    }
  }
```

### Polling Strategy

```
Submit Document → Poll every 2 seconds → Max 120 seconds
├─ Status: queued/processing → Keep polling
├─ Status: completed → Fetch report
├─ Status: error → Retry with backoff
└─ Timeout → Fallback to LocalCorpus + AI
```

### Error Handling

| Error | Status | Action |
|-------|--------|--------|
| Timeout | - | Defer, retry later with exponential backoff |
| Rate Limited | 429 | Wait 60s, retry up to 3 times |
| Auth Failed | 401 | Alert admin, fallback to LocalCorpus only |
| Server Error | 5xx | Retry with exponential backoff, then fallback |
| Invalid Request | 400 | Log error, fallback to LocalCorpus |

### Configuration

```env
COPYLEAKS_API_KEY=your_api_key_here
COPYLEAKS_API_URL=https://api.copyleaks.com/v3
COPYLEAKS_TIMEOUT_MS=120000
```

### References

- [CopyLeaks API Documentation](https://api.copyleaks.com/documentation/v3)
- [CopyLeaks Dashboard](https://dashboard.copyleaks.com)

---

## Method 2: Local Corpus (Enhanced Fallback)

### Overview

Enhanced local plagiarism detection using institutional submission history with multiple similarity algorithms for robust matching.

### Algorithms

#### Cosine Similarity (Default)

Treats submissions as vectors of term frequencies. Best for detecting semantic plagiarism across different writing styles.

```
similarity = dot(v1, v2) / (||v1|| * ||v2||)
Range: [0, 1] (higher = more similar)
```

**Use Case**: Essays, short answers where word order may change

#### Jaccard Index

Set-based similarity comparing unique tokens. Good for structured content and detecting reordering.

```
similarity = |intersection| / |union|
Range: [0, 1]
```

**Use Case**: Code submissions, structured content

#### Edit Distance (Levenshtein)

Character-level distance measuring insertions, deletions, substitutions. Detects copy-paste with minor modifications.

```
similarity = 1 - (distance / max_length)
Range: [0, 1]
```

**Use Case**: Detecting exact copy-paste with small changes

#### Hybrid (Recommended)

Combines all three methods with equal weighting for best coverage:

```
similarity = (cosine + jaccard + edit_distance) / 3
```

### Configuration

```env
LOCAL_SIMILARITY_THRESHOLD=0.8        # Range: 0.7-0.9
LOCAL_SIMILARITY_ALGORITHM=hybrid     # Options: cosine, jaccard, edit-distance, hybrid
```

### Performance Optimizations

1. **Embedding Cache**: Caches frequently compared submissions in memory (max 1000 entries)
2. **Incremental Updates**: New submissions added to corpus immediately
3. **Database Indexing**: Uses PostgreSQL GIN index on submission content
4. **Tenant Isolation**: Only searches within tenant scope

### Corpus Management

The local corpus includes:
- All submissions in tenant across all courses
- Only SUBMITTED and GRADED submissions
- Excludes current assignment (prevents self-matching)
- Excludes student's own prior submissions (allows resubmission)

### Query Strategy

```sql
SELECT s.id, s.file_path, u.email, s.submitted_at
FROM grading.submissions s
JOIN grading.users u ON s.student_id = u.id
WHERE 
  s.tenant_id = $tenant_id
  AND s.assignment_id != $assignment_id  -- Different assignment
  AND s.student_id != $student_id         -- Different student
  AND s.file_path IS NOT NULL
  AND LENGTH(s.file_path) > 50
ORDER BY s.submitted_at DESC
LIMIT 50
```

### Corpus Statistics

Access corpus statistics via:

```typescript
const stats = await localCorpusService.getCorpusStats(tenantId);
// Returns: { totalSubmissions: 1245, totalIndexed: 1245 }
```

### Cleanup

Optionally remove old entries:

```typescript
await localCorpusService.cleanupOldEntries(tenantId, 365);
// Removes submissions older than 365 days
```

---

## Method 3: AI Content Detection

### Overview

Detects AI-generated content using specialized models. Separate from plagiarism score per Requirement 9.3.

### Strategies

1. **OpenAI Davinci**: Uses OpenAI's content moderation API
2. **Local GPT-2**: Runs locally without API calls
3. **ZeroGPT API**: Specialized AI detection service

### Configuration

```env
AI_DETECTION_STRATEGY=openai    # Options: openai, gpt2, zerogpt
OPENAI_DETECTION_KEY=your_key
AI_DETECTION_THRESHOLD=0.50
```

### Response Format

```typescript
{
  ai_score: 42.5,           // 0-100%
  ai_detected: true,        // Boolean flag
  confidence: 0.87,         // 0-1 confidence
  explanation: "...",       // Reasoning
  method: "openai"          // Method used
}
```

### Accuracy Targets

- True Positive Rate: >80% for actual AI content
- False Positive Rate: <10% for human-written content
- Precision: >85% for AI-flagged submissions

---

## Three-Method Orchestration

### Unified Workflow

```typescript
async scanSubmission(submissionId, tenantId):
  1. Create PENDING PlagiarismResult
  2. Try CopyLeaks with 120s timeout
     ├─ Success → return combined result
     ├─ Timeout → mark as incomplete
     └─ Error → continue to step 3
  3. In parallel:
     ├─ Try LocalCorpus (30s timeout)
     └─ Try AI Detection (30s timeout)
  4. Combine scores:
     - plagiarismScore = max(copyleaks, local)
     - aiGenerationScore = separate metric
  5. Update PlagiarismResult with COMPLETED
  6. Check against threshold, flag if needed
```

### Score Combination Logic

```
If CopyLeaks successful:
  plagiarismScore = CopyLeaks plagiarismScore
  aiScore = CopyLeaks aiScore (if available)
Else:
  plagiarismScore = max(LocalCorpus score, AI score)
  aiScore = AI Detection score
```

### Error Handling by Method

| Scenario | Action |
|----------|--------|
| CopyLeaks timeout | Retry with exponential backoff, then fallback |
| CopyLeaks rate limited | Wait 60s, retry up to 3 times |
| CopyLeaks auth error | Alert admin, use LocalCorpus only |
| LocalCorpus unavailable | Continue with CopyLeaks + AI only |
| AI detection failed | Continue with other methods |
| All methods fail | Set status FAILED, alert instructor |

---

## API Integration

### Example: CopyLeaks Configuration

```typescript
// In .env
COPYLEAKS_API_KEY=sk_live_abc123...
COPYLEAKS_API_URL=https://api.copyleaks.com/v3

// In NestJS service
const result = await this.copyLeaksService.detect(
  content,
  submissionId,
  assignmentId,
  tenantId
);

console.log(`Plagiarism: ${result.plagiarismScore}%`);
console.log(`AI Score: ${result.aiGenerationScore}%`);
console.log(`Sources: ${result.sourceMatches.length}`);
```

### Example: LocalCorpus Configuration

```typescript
// In .env
LOCAL_SIMILARITY_THRESHOLD=0.8
LOCAL_SIMILARITY_ALGORITHM=hybrid

// In NestJS service
const result = await this.localCorpusService.detect(
  content,
  submissionId,
  assignmentId,
  tenantId
);

console.log(`Plagiarism: ${result.plagiarismScore}%`);
console.log(`Matches: ${result.sourceMatches.length}`);
```

---

## Database Schema

### PlagiarismResult

```sql
CREATE TABLE grading.plagiarism_results (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  institution_id UUID NOT NULL,
  submission_id UUID NOT NULL,
  assignment_id UUID NOT NULL,
  overall_score DECIMAL(5,2),      -- 0-100%
  ai_generation_score DECIMAL(5,2), -- 0-100%
  source_matches JSONB,             -- Array of matches
  status VARCHAR(50),               -- PENDING, COMPLETED, FAILED
  external_scan_id VARCHAR(255),    -- CopyLeaks submission ID
  error_message TEXT,
  scanned_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (tenant_id) REFERENCES grading.institutions(tenant_id),
  FOREIGN KEY (submission_id) REFERENCES grading.submissions(id),
  INDEX (tenant_id, status),
  INDEX (submission_id)
);
```

### PlagiarismFlag

```sql
CREATE TABLE grading.plagiarism_flags (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  plagiarism_result_id UUID NOT NULL,
  status VARCHAR(50),               -- FLAGGED, INVESTIGATING, RESOLVED, DISMISSED
  threshold_exceeded_by DECIMAL(5,2),
  investigation_notes TEXT,
  instructor_action VARCHAR(255),   -- WARNING, INVESTIGATION, DISMISSAL
  flagged_at TIMESTAMP,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (tenant_id) REFERENCES grading.institutions(tenant_id),
  FOREIGN KEY (plagiarism_result_id) REFERENCES grading.plagiarism_results(id)
);
```

---

## Requirements Compliance

| Requirement | Implementation |
|-------------|-----------------|
| 9.1 Scan submissions | CopyLeaks + LocalCorpus |
| 9.2 Generate plagiarism score | max(CopyLeaks, LocalCorpus) |
| 9.3 Detect AI-generated content | AI Detection Service |
| 9.4 Institutional threshold | PlagiarismFlag with threshold check |
| 9.5 Identify matched sources | CopyLeaks source matches |
| 9.6 Review plagiarism reports | PlagiarismFlag workflow |
| 9.7 Record investigation actions | PlagiarismFlag investigation notes |
| 9.8 Institutional database | LocalCorpus corpus |
| 9.9 Evidence preservation | Immutable PlagiarismResult records |

---

## Testing

### Unit Tests

- CopyLeaks API error handling (timeout, rate limit, auth)
- LocalCorpus similarity algorithms (cosine, Jaccard, edit distance)
- AI Detection score formatting
- Score combination logic
- Threshold checking and flagging

### Integration Tests

- End-to-end plagiarism scanning workflow
- Database record creation and updates
- Fallback behavior when primary service unavailable
- Error handling and retry logic

### Property-Based Tests

- **Property 6**: Plagiarism score threshold triggering
- **Property 10**: Audit trail immutability
- **Property 12**: Late penalty consistency

---

## Monitoring & Operations

### Health Checks

```bash
# Check CopyLeaks availability
GET /health/plagiarism/copyleaks

# Check LocalCorpus availability
GET /health/plagiarism/local-corpus

# Check AI Detection availability
GET /health/plagiarism/ai-detection
```

### Metrics to Track

- Average scan time by method
- Success rate by method
- Fallback trigger frequency
- Score distribution across submissions
- Flagging rate vs threshold

### Common Issues

| Issue | Diagnosis | Solution |
|-------|-----------|----------|
| High timeout rate | CopyLeaks overloaded | Increase timeout, use LocalCorpus more |
| Inaccurate LocalCorpus | Bad algorithm choice | Try hybrid or different algorithm |
| No AI score | API key missing | Configure AI_DETECTION_STRATEGY |
| Corpus too large | Performance degradation | Enable cleanup for old submissions |

---

## Future Enhancements

1. **Webhook support**: Real-time notifications from CopyLeaks
2. **Machine learning**: Learn optimal thresholds per institution
3. **Semantic matching**: Use embeddings for better semantic matching
4. **Source filtering**: Exclude certain source types by policy
5. **Investigation workflow**: Automated investigation actions
