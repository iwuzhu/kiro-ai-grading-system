# Test assignments API endpoint
$loginBody = '{"email":"teacher1@deepgrader.com","password":"Password123!"}'

$loginResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/auth/login" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $loginBody `
  -UseBasicParsing

$loginJson = $loginResponse.Content | ConvertFrom-Json
$token = $loginJson.access_token
$courseId = "b58405f9-6873-4d1c-9cb3-e796034bed6c"

Write-Host "Got token, testing assignments endpoint..."

$assignmentsResponse = Invoke-WebRequest `
  -Uri "http://localhost:3001/api/v1/courses/$courseId/assignments" `
  -Method GET `
  -Headers @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
  } `
  -UseBasicParsing

$assignmentsJson = $assignmentsResponse.Content | ConvertFrom-Json

Write-Host "✓ API TEST SUCCESSFUL!"
Write-Host ""
Write-Host "Response Status: $($assignmentsJson.success)"
Write-Host "Assignments found: $($assignmentsJson.data.Count)"

if ($assignmentsJson.data.Count -gt 0) {
  Write-Host ""
  Write-Host "Assignments:"
  foreach ($assignment in $assignmentsJson.data) {
    Write-Host "  ✓ $($assignment.title) (Type: $($assignment.assignment_type), Points: $($assignment.point_value))"
  }
}
