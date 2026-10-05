#!/bin/bash

# Test Submission Upload Flow
# This script tests the complete submission upload process

BACKEND_URL="http://localhost:3001/api/v1"

# Test tokens (should exist in database)
# For testing, we need:
# 1. A valid tenant ID
# 2. A valid user ID (student)
# 3. A valid assignment ID

# Create test data
echo "=== Testing Submission Upload Flow ==="
echo ""

# Step 1: Get a valid JWT token (you'll need to login first or use an existing token)
echo "Step 1: Using existing JWT token from localStorage"
echo "To run this test, you need to:"
echo "1. Login to the app as a student"
echo "2. Open browser console and run: localStorage.getItem('accessToken')"
echo "3. Copy that token and update TOKEN= below"
echo ""

# Example with hardcoded test token (replace with real token)
TOKEN="YOUR_JWT_TOKEN_HERE"

if [ "$TOKEN" = "YOUR_JWT_TOKEN_HERE" ]; then
  echo "⚠️  Please update the TOKEN variable with a valid JWT token"
  exit 1
fi

# Step 2: List assignments to get a valid assignment ID
echo "Step 2: Getting assignments..."
ASSIGNMENTS=$(curl -s -X GET \
  "$BACKEND_URL/courses/YOUR_COURSE_ID/assignments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: YOUR_TENANT_ID" \
  | jq '.')

echo "Assignments response:"
echo "$ASSIGNMENTS" | jq '.'
ASSIGNMENT_ID=$(echo "$ASSIGNMENTS" | jq -r '.data[0].id' 2>/dev/null)

if [ -z "$ASSIGNMENT_ID" ] || [ "$ASSIGNMENT_ID" = "null" ]; then
  echo "❌ Could not get assignment ID"
  exit 1
fi

echo "Using assignment ID: $ASSIGNMENT_ID"
echo ""

# Step 3: Upload a test file
echo "Step 3: Uploading a test file..."

# Create a test file
echo "Test submission content" > /tmp/test-submission.txt

UPLOAD_RESPONSE=$(curl -s -X POST \
  "$BACKEND_URL/submissions/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: YOUR_TENANT_ID" \
  -F "file=@/tmp/test-submission.txt" \
  -F "assignmentId=$ASSIGNMENT_ID" \
  | jq '.')

echo "Upload response:"
echo "$UPLOAD_RESPONSE" | jq '.'

SUBMISSION_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.data.id' 2>/dev/null)

if [ -z "$SUBMISSION_ID" ] || [ "$SUBMISSION_ID" = "null" ]; then
  echo "❌ Upload failed - no submission ID returned"
  exit 1
fi

echo "✅ Submission ID: $SUBMISSION_ID"
echo ""

# Step 4: Verify the submission exists in database
echo "Step 4: Fetching submission to verify it was saved..."

FETCH_RESPONSE=$(curl -s -X GET \
  "$BACKEND_URL/submissions/assignments/$ASSIGNMENT_ID/history" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: YOUR_TENANT_ID" \
  | jq '.')

echo "Submission fetch response:"
echo "$FETCH_RESPONSE" | jq '.'

COUNT=$(echo "$FETCH_RESPONSE" | jq 'length' 2>/dev/null)

if [ "$COUNT" -gt 0 ]; then
  echo "✅ SUCCESS: $COUNT submission(s) found in database"
else
  echo "❌ FAILURE: No submissions found in database after upload"
fi

echo ""
echo "=== Test Complete ==="
