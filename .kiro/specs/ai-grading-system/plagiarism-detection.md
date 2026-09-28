# Plagiarism Detection Architecture Guide

## Overview

The plagiarism detection system uses a three-method approach to provide comprehensive academic integrity monitoring:

1. **External API Method** (Turnitin) - Primary detection with professional scanning
2. **Local Corpus Method** - Institutional history matching (privacy-focused fallback)
3. **AI Content Detection** - Synthetic content identification (separate metric)

This multi-method design ensures:
- **Resilience**: Continues operating even if primary service fails
- **Accuracy**: Combines multiple detection strategies for confidence
- **Privacy**: Local corpus supports scanning without third-party uploads
- **Compliance**: Separate tracking of plagiarism vs. AI content per Requirement 9.3

---

## Method 1: External API (Turnitin)

### Integration Architecture

Submission receives Turnitin scanning through API client wrapper with authentication, document submission, polling for completion (max 120s), and result parsing including plagiarism score (0-100%), AI detection score (0-100%), and source matches stored as JSONB.

### Turnitin API Endpoints

POST /submission for document submission, GET /submission/{id} for status polling, GET /submission/{id}/report for retrieving results.

### Error Handling

Timeout greater than 120s: Defer and retry with exponential backoff (1s, 2s, 4s, 8s)
Rate Limit 429: Exponential backoff with circuit breaker
Server Error 5xx: Retry with exponential backoff, then fallback
Authentication 401: Alert admin and log incident

### Configuration

TURNITIN_API_KEY, TURNITIN_CLIENT_ID, TURNITIN_ENDPOINT, TURNITIN_TIMEOUT_MS values from environment.

---

## Method 2: Local Corpus (Fallback)

### Architecture

Institutional submissions database queries PostgreSQL pg_trgm text search. Builds trigram index on submission text and queries similarity(new_text, corpus_text) > 0.8 to calculate score from match count.

### PostgreSQL Setup

CREATE EXTENSION IF NOT EXISTS pg_trgm enables pg_trgm extension.
CREATE INDEX idx_submission_text_trgm ON submissions USING GiST creates GiST index for trigram search.
CREATE INDEX idx_submission_tenant_created ON submissions creates BRIN index for tenant_id and created_at range queries.

### Similarity Calculation

For each corpus submission, calculate similarity as word overlap divided by total unique words. If similarity exceeds 0.80, add to contribution. Final plagiarism score is minimum of 100 and average of all match percentages.

### Corpus Management

Includes all submissions in tenant across all courses, only SUBMITTED and GRADED submissions, excludes current assignment to avoid self-matching, and excludes students' own prior submissions to allow resubmission.

---

## Method 3: AI Content Detection

### Detection Strategies

Strategy 1: OpenAI Davinci Model analyzes text for AI characteristics and returns likelihood percentage. 
Strategy 2: Local GPT-2 Detector runs locally on server without API calls.
Strategy 3: ZeroGPT API submits text to specialized AI detection service.

### Implementation Configuration

AI_DETECTION_STRATEGY environment variable selects openai, gpt2, or zerogpt.
OPENAI_DETECTION_KEY provides API access.
AI_DETECTION_THRESHOLD sets confidence level (0.50 = 50%).

### Response Format

Returns ai_score (0-100), ai_detected boolean, confidence (0-1), explanation string, and method used.

### Accuracy Metrics

Target performance: TPR greater than 80% for actual AI content, FPR less than 10% for human-written content, Precision greater than 85% for AI-flagged content.

---

## Three-Method Orchestration

### Unified Workflow

Submission received triggers plagiarism scanning service. Attempts Method 1 (Turnitin) with success using score, timeout >120s triggering defer and fallback, or error triggering fallback to Method 2. Always attempts Method 2 (Local Corpus) as quick local option. Always attempts Method 3 (AI Content Detection) as separate score. Combines results with plagiarism_score as max(turnitin_score, local_score), ai_score as separate metric, and creates PlagiarismResult record.

### Score Combination Logic

If turnitin available, plagiarism_score equals turnitin plagiarism score. Otherwise plagiarism_score equals local corpus score. AI score is always separate, never combined with plagiarism.

### Error Handling Strategy

Turnitin timeout: Retry exponential backoff max 4 attempts, fallback to local corpus.
Turnitin 429 rate limit: Pause and retry after 60s, fallback to local corpus.
Turnitin 5xx error: Retry with backoff, fallback to local corpus.
Turnitin 401 auth: Alert admin, fallback to local corpus.
Local corpus unavailable: Continue without local data, use Turnitin only.
AI detection failed: Continue without AI score, proceed with plagiarism scores.

---

## Requirements Compliance

Requirement 9: Plagiarism detection and reporting with AI content score
Requirement 11: Plagiarism threshold configuration
Requirement 17: Evidence preservation and immutable records
Requirement 20: Audit trail and compliance reporting
Requirement 21: Immutable records for investigation

Privacy supports local-first scanning, optional Turnitin for enhanced detection, no submission text transmitted without consent, and audit trail of all detection methods.

Academic integrity ensured through three-method approach preventing gaming of single detector, AI content separately tracked not conflated with plagiarism, investigation workflow ensuring due process, and evidence preserved for institutional review.
