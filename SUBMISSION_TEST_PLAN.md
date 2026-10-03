# Submit Assignment Functionality - Test Plan

## Overview
This document outlines the testing strategy for the "Submit Assignment" feature implemented for the AI Grading System.

## Components Implemented

### Frontend Components
1. **SubmissionModal** (`frontend/src/components/common/SubmissionModal.tsx`)
   - Modal dialog for assignment submission
   - Supports both text-based and file-based submissions
   - Validates input and displays error messages
   - Shows submission type and provides helpful guidance

2. **Hooks**
   - `useSubmission` - Handles API calls to submit assignments
   - `useAssignmentSubmissions` - Fetches submission history

3. **Integration**
   - Updated student assignment detail page to include:
     - "Submit Assignment" button
     - SubmissionModal integration
     - Previous submissions section (for incremental assignments)
     - Submission status display

### Backend Endpoints
- **POST** `/v1/submissions/assignments/{assignmentId}/submit`
  - Creates a new submission for a student
  - Validates assignment exists and is published
  - Checks deadline (soft/hard)
  - Handles incremental submissions
  - Returns submission with version number

- **GET** `/v1/submissions/assignments/{assignmentId}/history`
  - Fetches all submissions for current student on an assignment
  - Returns sorted by version (descending)
  - Handles 404 gracefully if no submissions exist

## Test Scenarios

### Scenario 1: Text-Based Submission (Essay)
**Setup:**
- Create an essay assignment (type: ESSAY)
- Set soft deadline to 2 days from now
- Set hard deadline to 3 days from now
- Allow incremental submissions

**Steps:**
1. Login as student
2. Navigate to assignment details
3. Click "Submit Assignment"
4. Enter essay text in textarea (at least 10 words)
5. Click "Submit Assignment" button
6. Verify success message and modal closes
7. Verify submission appears in "Previous Submissions" section
8. Verify submission status shows "1 submission(s)"

**Expected Results:**
- ✓ Modal opens with textarea
- ✓ Submit button disabled if text is empty
- ✓ Submission created successfully
- ✓ Version = 1
- ✓ is_late = false (submitted before soft deadline)
- ✓ Submission history displays with timestamp

### Scenario 2: File-Based Submission (Code)
**Setup:**
- Create a code assignment (type: CODE)
- Allow single submission (allow_incremental = false)

**Steps:**
1. Login as student
2. Navigate to assignment details
3. Click "Submit Assignment"
4. Upload a code file (e.g., solution.py)
5. Click "Submit Assignment"
6. Verify success

**Expected Results:**
- ✓ Modal shows file upload area
- ✓ File selected shows filename
- ✓ Submission created with file_type = "py"
- ✓ Version = 1
- ✓ File path stored correctly

### Scenario 3: Incremental Submission
**Setup:**
- Create assignment with allow_incremental = true
- Have 1 existing submission from Scenario 1

**Steps:**
1. Login as student
2. Navigate to assignment details
3. Verify "Previous Submissions" section shows Version 1
4. Click "Submit Assignment"
5. Enter new essay text (different from first)
6. Submit

**Expected Results:**
- ✓ New submission created with version = 2
- ✓ Previous submissions section now shows both versions
- ✓ Both sorted by version descending (v2 first)
- ✓ "View Previous Submissions" button visible
- ✓ Multiple Submissions shows "Allowed"

### Scenario 4: Late Submission
**Setup:**
- Create assignment with soft deadline = 1 hour ago
- Hard deadline = 24 hours from now

**Steps:**
1. Login as student
2. Navigate to assignment details
3. Verify "Due Soon" or "Overdue" badge shows appropriately
4. Click "Submit Assignment"
5. Submit text

**Expected Results:**
- ✓ Submission created with is_late = true
- ✓ Previous Submissions section shows "⏰ Submitted after soft deadline" warning
- ✓ Late badge visible on submission

### Scenario 5: Closed Assignment (Hard Deadline Passed)
**Setup:**
- Create assignment with hard deadline = 1 hour ago

**Steps:**
1. Login as student
2. Navigate to assignment details
3. Verify "Submission Closed" button visible (disabled)
4. Attempt to click it

**Expected Results:**
- ✓ "Submit Assignment" button disabled
- ✓ Shows "Submission Closed" text
- ✓ Modal does NOT open
- ✓ Red warning box shows "Assignment Closed"

### Scenario 6: Validation Errors
**Steps:**
1. Open SubmissionModal for essay assignment
2. Leave textarea empty
3. Click "Submit Assignment"

**Expected Results:**
- ✓ Error message: "Please enter your submission text"
- ✓ Modal remains open
- ✓ Submission not created

**Step 2:**
1. Open SubmissionModal for file assignment
2. Don't select any file
3. Click "Submit Assignment"

**Expected Results:**
- ✓ Error message: "Please select a file to submit"
- ✓ Modal remains open

### Scenario 7: File Size Validation
**Steps:**
1. Open SubmissionModal for file assignment
2. Try to upload file > 50MB

**Expected Results:**
- ✓ Error message: "File size must be less than 50MB"
- ✓ File not accepted

### Scenario 8: API Error Handling
**Setup:**
- Simulate API failure by disconnecting network

**Steps:**
1. Open SubmissionModal
2. Submit while network is disconnected

**Expected Results:**
- ✓ Loading spinner shows
- ✓ Error message displays after timeout
- ✓ Modal stays open for retry
- ✓ Can dismiss with "Cancel" button

### Scenario 9: Submission History Display
**Setup:**
- 3 submissions from same student on same assignment

**Steps:**
1. Navigate to assignment details
2. Check "Previous Submissions" section

**Expected Results:**
- ✓ All 3 submissions display
- ✓ Sorted by version descending (v3, v2, v1)
- ✓ Each shows timestamp
- ✓ Late indicators show correctly
- ✓ Loading state shows while fetching

### Scenario 10: Permission-Based Access
**Setup:**
- Different students
- One assignment

**Steps:**
1. Student A submits assignment
2. Student B views their assignment details (same assignment)
3. Check submission history

**Expected Results:**
- ✓ Student B sees no submissions (or only their own)
- ✓ Student A's submissions NOT visible to Student B
- ✓ Tenant isolation enforced

## API Response Format Verification

### Create Submission Response
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "assignment_id": "uuid",
    "version": 1,
    "file_path": "s3://...",
    "file_type": "pdf",
    "is_late": false,
    "submitted_at": "2024-10-02T15:30:00Z"
  }
}
```

### Get Submissions History Response
```json
[
  {
    "id": "uuid",
    "assignment_id": "uuid",
    "student_id": "uuid",
    "version": 2,
    "file_path": "s3://...",
    "file_type": "py",
    "is_late": false,
    "submitted_at": "2024-10-02T14:00:00Z",
    "created_at": "2024-10-02T14:00:00Z"
  },
  {
    "id": "uuid",
    "assignment_id": "uuid",
    "student_id": "uuid",
    "version": 1,
    "file_path": "s3://...",
    "file_type": "py",
    "is_late": true,
    "submitted_at": "2024-10-02T10:00:00Z",
    "created_at": "2024-10-02T10:00:00Z"
  }
]
```

## Manual Testing Checklist

### Setup
- [ ] Database has test accounts (student, instructor, admin)
- [ ] Backend is running (npm run start)
- [ ] Frontend is running (npm run dev)
- [ ] Sample assignments created with different types
- [ ] Deadlines set appropriately

### UI Testing
- [ ] Submit button visible on assignment details
- [ ] Modal opens when not overdue
- [ ] Modal closed when overdue
- [ ] Form validation works
- [ ] Error messages clear and helpful
- [ ] Loading spinner shows during submission
- [ ] Success closes modal automatically
- [ ] Previous submissions section displays

### API Testing
- [ ] POST /v1/submissions/assignments/{id}/submit succeeds
- [ ] GET /v1/submissions/assignments/{id}/history returns sorted list
- [ ] Late detection works correctly
- [ ] Incremental submission versioning works
- [ ] Tenant isolation enforced
- [ ] 404 returns when assignment not found
- [ ] 400 returns when deadline passed

### Edge Cases
- [ ] Empty submission rejected
- [ ] Very large file rejected
- [ ] Concurrent submissions handled
- [ ] Rapid clicks don't create duplicates
- [ ] Refresh page preserves submission history

## Performance Benchmarks

Target SLAs:
- Submit Assignment: < 3 seconds
- Fetch Submission History: < 1 second
- Modal open/close: Instant

## Browser Compatibility
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge

## Known Limitations
1. File uploads are mocked (stored as base64 in filePath)
   - In production: upload to S3, get signed URL
2. No resume/pause for large files
   - Should implement for files > 100MB
3. No progress indicator for upload
   - Should add for UX clarity

## Future Enhancements
1. Drag-and-drop file upload
2. Multiple file selection
3. Progress indicator for upload
4. File preview before submission
5. Submit at scheduled time
6. Submission plagiarism check before upload
7. Cost display (AI grading cost)
8. Draft save feature
