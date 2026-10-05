# Assignment Content Display - Debug Log Reference

## Quick Console Log Lookup

### When Content Is Not Displayed

1. **Open Browser DevTools:** F12 → Console tab
2. **Look for these log sequences:**

```
✅ GOOD SEQUENCE:
[StudentAssignmentDetail] Fetching assignment... {assignmentId: "..."}
[StudentAssignmentDetail] API Response status: 200
[StudentAssignmentDetail] Assignment data received: {hasContent: true, contentKeys: ["questions"]}
[StudentAssignmentDetail] Starting content parsing... {contentIsArray: false}
[StudentAssignmentDetail] Detected NEW format (questions array) {questionsLength: 3}
[StudentAssignmentDetail] Grouped questions by type {types: ["ESSAY", "CODE"]}
[StudentAssignmentDetail] Created question groups from NEW format {groupsCount: 2}
[StudentAssignmentDetail] Question groups set {totalGroups: 2, totalQuestions: 3}
[QuestionList] useEffect triggered {questionGroupsCount: 2, rubricIdsNeeded: ["rubric-1", "rubric-2"]}
[QuestionList] Fetching rubrics... {rubricIdsCount: 2}
[QuestionList] Rubrics API response: {status: 200}
[QuestionList] Rubrics received {rubricCount: 2}
[QuestionList] Rubric map updated {mapSize: 2}
[QuestionList] Rendering question groups {groupsCount: 2, rubricMapSize: 2}
```

```
❌ BAD SEQUENCE - Content exists but not parsed:
[StudentAssignmentDetail] Assignment data received: {hasContent: true, contentKeys: ["Essay", "Code"]}
[StudentAssignmentDetail] Starting content parsing...
[StudentAssignmentDetail] Detected OLD format (nested object) {topLevelKeys: ["Essay", "Code"]}
```
→ OLD format detected - should still work, check if groups created

```
❌ BAD SEQUENCE - No content:
[StudentAssignmentDetail] Assignment data received: {hasContent: false}
[StudentAssignmentDetail] No content to parse
```
→ Content doesn't exist in database. Check database.

```
❌ BAD SEQUENCE - Parse error:
[StudentAssignmentDetail] Error parsing content: SyntaxError: Unexpected token...
```
→ Content JSONB is corrupted. Check database directly.

```
❌ BAD SEQUENCE - Rubric issue:
[QuestionList] Fetching rubrics from API...
[QuestionList] Rubrics API response: {status: 401}
```
→ Authentication failed. Check token.

```
❌ BAD SEQUENCE - No tenant ID:
[QuestionList] Skipping rubric fetch: {reason: "no tenant ID"}
```
→ User auth not loaded. Reload page.

---

## Log Levels

| Prefix | Meaning | Action |
|--------|---------|--------|
| `[StudentAssignmentDetail]` | Student details page logic | Check if content loaded |
| `[QuestionList]` | Question display component | Check if rubrics loaded |
| ⚠️ `Content format not recognized` | Parser issue | Format mismatch |
| ❌ `Error parsing content:` | Exception in parser | JSONB corruption |
| ✅ No logs at all | JS not loaded or error before logging | Hard refresh page |

---

## Common Issues & Solutions

### Issue: "Assignment Content & Rubrics" Section Missing

**Check these logs in order:**
1. `[StudentAssignmentDetail] API Response status:` → Should be 200
2. `hasContent: true` → Should be true
3. `Question groups set` → Should show totalGroups > 0

**If #3 missing but #2 true:** Parser failed
- Check `Error parsing content` log
- Look at `Content format not recognized` log
- Content JSONB structure doesn't match NEW or OLD format

**If #2 false:** No content in database
- Run: `SELECT id, content FROM grading.assignments WHERE id = '<assignment-id>';`
- Content field should not be NULL

**If #1 not 200:** API issue
- Status 404 = Assignment not found
- Status 401 = Token expired
- Status 500 = Server error

---

### Issue: Content Displays But No Rubric

**Check these logs:**
1. `[QuestionList] Fetching rubrics...` → Should be present
2. `rubricIdsNeeded:` → Should have IDs
3. `Rubrics API response: {status: 200}` → Should be 200
4. `Rubrics received` → Should show rubricCount > 0
5. `rubricLoaded: true/false` in render log → Should be true

**If #1 missing:** No questions have rubric IDs
- Run: `SELECT id, rubric_id FROM grading.assignments WHERE id = '<assignment-id>';`
- rubric_id should not be NULL

**If #3 not 200:**
- Status 401 = Auth failed - check token
- Status 404 = Rubric not found - verify rubric exists
- Status 500 = Server error

**If #4 shows count 0:** No rubrics returned
- Run: `SELECT id, name FROM grading.rubrics WHERE tenant_id = '<tenant-id>';`
- Should return records

**If #5 false:** Rubric fetched but not in map
- Check rubric ID in `Rubric map updated` log
- Should include the ID from question group

---

### Issue: Parsing Detected OLD Format But Not Displaying

**This is normal!** OLD format support is included for backwards compatibility.

**Check:**
1. `[StudentAssignmentDetail] Detected OLD format (nested object)` → Expected
2. `Created question groups from OLD format` → Should show groupsCount > 0
3. `Question groups set {totalGroups: X}` → X should be > 0

**If #3 shows 0:**
- OLD format structure didn't match expected pattern
- Run: `SELECT content FROM grading.assignments WHERE id = '<assignment-id>' LIMIT 1;`
- Check JSON structure:
  - Should have keys like: "Essay", "Code", "Math", etc.
  - Each key should have "RubricId" and "Question N" entries
  - Questions should have nested structure: `{prompt: {Result, Points}}`

---

## Database Validation Queries

### Check if Assignment Has Content
```sql
SELECT id, title, content IS NOT NULL as has_content, 
       jsonb_typeof(content) as content_type
FROM grading.assignments 
WHERE id = '<assignment-id>';
```

### Check Content Format
```sql
SELECT id, 
       CASE 
         WHEN content ? 'questions' THEN 'NEW'
         WHEN content ? 'Essay' OR content ? 'Code' THEN 'OLD'
         ELSE 'UNKNOWN'
       END as content_format,
       content
FROM grading.assignments 
WHERE id = '<assignment-id>';
```

### Validate JSONB Structure
```sql
SELECT id, jsonb_valid(content) as is_valid_json
FROM grading.assignments 
WHERE id = '<assignment-id>';
```

### Check Rubrics
```sql
SELECT id, name, criteria IS NOT NULL as has_criteria
FROM grading.rubrics 
WHERE id = '<rubric-id>';
```

---

## Export Console Logs

### Method 1: Copy-Paste
1. Open DevTools → Console
2. Right-click → Select All
3. Copy (Ctrl+C)
4. Paste into text file
5. Search for `[StudentAssignmentDetail]` and `[QuestionList]`

### Method 2: Filter in Console
```javascript
// Show only assignment content logs
$0.querySelectorAll('[data-level="log"]') // If logs are in DOM

// Or use console filter feature in DevTools
// Click filter icon, type: [StudentAssignmentDetail]
```

### Method 3: Export to File
```javascript
// Run in console to get all logs since page load
const logs = [];
const originalLog = console.log;
console.log = function(...args) {
  originalLog.apply(console, args);
  const message = args.map(a => 
    typeof a === 'object' ? JSON.stringify(a, null, 2) : a
  ).join(' ');
  logs.push({time: new Date().toISOString(), msg: message});
};

// Later, export:
copy(JSON.stringify(logs, null, 2));
// Paste into file: debug_logs.json
```

---

## Performance Notes

- Content parsing takes <50ms
- Rubric fetching takes <500ms
- Total time to display: <1s
- If slower, check network tab for API delays

---

## Next Steps if Issue Persists

1. **Collect Data:**
   - Export console logs (see above)
   - Get assignment ID
   - Get user ID
   - Screenshot of page

2. **Run DB Queries:**
   - Check content format (see above)
   - Verify JSONB validity
   - Check rubric exists

3. **Check Network:**
   - DevTools → Network tab
   - Look for `/v1/courses/assignments/` request
   - Check response body for content field
   - Look for `/v1/courses/rubrics` request

4. **Report Issue:**
   - Include assignment ID
   - Include console logs
   - Include network requests
   - Include any error messages

---

**Last Updated:** 2024-10-02  
**Component Version:** 2.0 (with comprehensive logging)  
**Status:** Production Ready
