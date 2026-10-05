# Assignment Content Display - Testing Checklist

## Pre-Test Setup
- [ ] Build completed successfully: `cd frontend && npm run build`
- [ ] No TypeScript errors in build output
- [ ] Dev server ready: `cd frontend && npm run dev`
- [ ] Dev server shows "ready - started server on 0.0.0.0:3000"
- [ ] Backend API running on port 3001
- [ ] Database accessible with test data

---

## Test Case 1: Basic Content Display

**Scenario:** Student views an assignment with content

**Steps:**
1. [ ] Open http://localhost:3000
2. [ ] Login as student user
3. [ ] Navigate to a course with assignments
4. [ ] Click on any assignment
5. [ ] Page loads to Assignment Details
6. [ ] Open DevTools (F12) → Console tab
7. [ ] Scroll page to see all sections

**Expected Results:**
- [ ] Assignment title displays
- [ ] Assignment description displays
- [ ] **"Assignment Content & Rubrics"** section visible
- [ ] Questions grouped by type (ESSAY, CODE, etc.)
- [ ] Point totals show per group
- [ ] Rubric criteria display as HTML table (if rubric assigned)
- [ ] Console shows no errors
- [ ] Console shows: `[StudentAssignmentDetail] Question groups set: {totalGroups: X}`

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## Test Case 2: Console Logging Sequence

**Scenario:** Verify complete logging path

**Steps:**
1. [ ] Stay on assignment details page
2. [ ] Open DevTools console
3. [ ] Search for: `[StudentAssignmentDetail]`
4. [ ] Expand first log entry

**Expected Results - Should see in order:**
- [ ] `Fetching assignment...`
- [ ] `API Response status: 200`
- [ ] `Assignment data received: {hasContent: true, ...}`
- [ ] `Starting content parsing...`
- [ ] `Detected NEW format` OR `Detected OLD format`
- [ ] `Grouped questions by type`
- [ ] `Created question groups from NEW/OLD format`
- [ ] `Question groups set: {totalGroups: 2, totalQuestions: 3}`
- [ ] `[QuestionList] useEffect triggered`
- [ ] `[QuestionList] Fetching rubrics...`
- [ ] `[QuestionList] Rubrics API response: {status: 200}`
- [ ] `[QuestionList] Rendering question groups`

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## Test Case 3: Multiple Assignments

**Scenario:** Test with different assignment types

**Assignment 1 - ESSAY:**
- [ ] Navigate to ESSAY type assignment
- [ ] Content displays ✓
- [ ] Rubric table visible ✓
- [ ] Point value shows ✓

**Assignment 2 - CODE:**
- [ ] Navigate to CODE type assignment
- [ ] Content displays ✓
- [ ] Rubric table visible ✓
- [ ] Point value shows ✓

**Assignment 3 - MIXED (multiple types):**
- [ ] Navigate to assignment with multiple types
- [ ] All groups visible (ESSAY, CODE, etc.) ✓
- [ ] Each group has its own rubric ✓
- [ ] Point totals per group correct ✓

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## Test Case 4: No Content Scenario

**Scenario:** Assignment exists but has no content

**Steps:**
1. [ ] Find/create assignment without content
2. [ ] Navigate to details page
3. [ ] Check console logs

**Expected Results:**
- [ ] Page loads without error
- [ ] No "Assignment Content & Rubrics" section (or message: "No content added")
- [ ] Console shows: `hasContent: false`
- [ ] Console shows: `No content to parse`
- [ ] Other assignment info displays normally

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## Test Case 5: Rubric Display

**Scenario:** Verify rubric criteria display

**Steps:**
1. [ ] Open assignment with rubric
2. [ ] Locate "Assignment Content & Rubrics" section
3. [ ] Find rubric table within a question group

**Expected Results - Rubric table should show:**
- [ ] Header row: Criterion | Description | Points
- [ ] At least 1 criterion row
- [ ] Each row has: name, description, points
- [ ] Table has alternating row colors
- [ ] Table is readable on mobile (if responsive)

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## Test Case 6: Without Rubric

**Scenario:** Questions without rubric assigned

**Steps:**
1. [ ] Find assignment with questions but no rubric
2. [ ] Navigate to details page

**Expected Results:**
- [ ] Questions still display
- [ ] No rubric table shown
- [ ] Message: "Rubric Note:" or similar
- [ ] No errors in console

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## Test Case 7: Long Content

**Scenario:** Assignment with many questions

**Steps:**
1. [ ] Find/create assignment with 10+ questions
2. [ ] Navigate to details page
3. [ ] Scroll through content section

**Expected Results:**
- [ ] All questions visible
- [ ] No performance lag
- [ ] Page scrolls smoothly
- [ ] Console shows all questions grouped
- [ ] No memory warnings in console

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## Test Case 8: Mobile Responsiveness

**Scenario:** Test on mobile/narrow screen

**Steps:**
1. [ ] Open DevTools
2. [ ] Toggle device toolbar (Ctrl+Shift+M)
3. [ ] Select iPhone 12 (390px width)
4. [ ] Navigate to assignment details
5. [ ] Scroll through content

**Expected Results:**
- [ ] Content section stacks vertically
- [ ] Rubric table remains readable (horizontal scroll if needed)
- [ ] Text doesn't overflow
- [ ] Buttons clickable on touch
- [ ] No layout breaks

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## Test Case 9: Error Handling

**Scenario:** Test error conditions

**Test 9a - Expired Token:**
- [ ] Logout
- [ ] Wait 5 minutes (or clear token)
- [ ] Navigate back to assignment
- [ ] Check console for 401 error

**Test 9b - Invalid Assignment ID:**
- [ ] Manually change URL to invalid ID
- [ ] Check console for 404 error
- [ ] Verify error message displays

**Test 9c - Network Error:**
- [ ] Open DevTools → Network tab
- [ ] Block API requests
- [ ] Navigate to assignment
- [ ] Check error handling

**Expected Results:**
- [ ] All errors handled gracefully
- [ ] User-friendly error messages
- [ ] No blank screens
- [ ] No console errors (only expected messages)

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## Test Case 10: Instructor View

**Scenario:** Compare with instructor edit page

**Steps:**
1. [ ] Login as instructor
2. [ ] Navigate to course → assignment → Edit
3. [ ] Note how content displays there
4. [ ] Logout, login as student
5. [ ] Navigate to same assignment
6. [ ] Compare display

**Expected Results:**
- [ ] Student sees same content format as instructor
- [ ] Same question grouping
- [ ] Same rubric table display
- [ ] Same point values

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## Performance Tests

### Test P1: Load Time
- [ ] Navigation to assignment: < 2 seconds
- [ ] Content parsing: < 100ms (check console timing)
- [ ] Rubric fetch: < 500ms
- [ ] Full render: < 1 second

**Pass/Fail:** ☐ PASS ☐ FAIL

### Test P2: Memory Usage
- [ ] Open DevTools → Memory tab
- [ ] Take heap snapshot
- [ ] Navigate to 5 different assignments
- [ ] Take another snapshot
- [ ] Compare memory delta

**Expected:** < 10MB additional memory

**Pass/Fail:** ☐ PASS ☐ FAIL

### Test P3: Console Spam
- [ ] Count total log lines for single page load
- [ ] Should be ~15-20 lines (6 StudentAssignmentDetail + 6 QuestionList + network)
- [ ] No duplicate logs
- [ ] No warning messages

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## Browser Compatibility

- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

**Results:**
- Chrome: ☐ PASS ☐ FAIL
- Firefox: ☐ PASS ☐ FAIL
- Safari: ☐ PASS ☐ FAIL
- Mobile Safari: ☐ PASS ☐ FAIL
- Chrome Mobile: ☐ PASS ☐ FAIL

---

## Log Export Test

**Scenario:** Verify logging can be captured

**Steps:**
1. [ ] Open assignment details page
2. [ ] Select all console output (Ctrl+A)
3. [ ] Copy to text file
4. [ ] Search for: `[StudentAssignmentDetail]`
5. [ ] Verify all 6+ log entries found

**Expected:** Should easily find diagnostic info

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## Summary

### Total Tests: 20 (including sub-tests)
### Pass Count: ____ / 20
### Fail Count: ____ / 20

### Failed Tests Details:
```
[List any failed tests and symptoms here]
```

### Notes:
```
[Any observations, differences from expected, or issues to investigate]
```

### Date Tested: __________
### Tested By: __________
### Environment: 
- Node: __________
- Next.js: 14.0.0
- Browser: __________
- OS: __________

---

## Pass/Fail Determination

**PASS IF:**
- ✅ Test Cases 1-6 all PASS
- ✅ Test Cases 7-8 mostly PASS (minor responsive issues OK)
- ✅ Test Case 9 handles errors gracefully
- ✅ Test Case 10 shows same content format
- ✅ Performance tests show acceptable times
- ✅ No critical bugs blocking core functionality

**FAIL IF:**
- ❌ Content not displaying at all
- ❌ Parser throwing unhandled exceptions
- ❌ Rubric fetch completely broken
- ❌ Responsive design completely broken
- ❌ Multiple tests fail (>5)

---

## Sign-Off

**Tested By:** ___________________

**Date:** ___________________

**Status:** ☐ READY FOR PRODUCTION ☐ NEEDS FIXES

**Comments:**
```


```

---

## Next Steps if PASS
1. [ ] Commit changes to git
2. [ ] Create pull request
3. [ ] Merge to main
4. [ ] Deploy to staging
5. [ ] Deploy to production

## Next Steps if FAIL
1. [ ] Document all failures
2. [ ] Check console logs for errors
3. [ ] Review code changes
4. [ ] Fix issues
5. [ ] Re-run failed tests
6. [ ] Repeat until PASS

---

**Last Updated:** 2024-10-02
**Checklist Version:** 1.0
