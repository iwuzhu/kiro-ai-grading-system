# Suppress WebRequest warnings
$ProgressPreference = 'SilentlyContinue'

try {
  Write-Output "Logging in..."
  $loginResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/auth/login" `
    -Method POST `
    -Headers @{"Content-Type" = "application/json"} `
    -Body (@{ email = "teacher1@deepgrader.com"; password = "Password123!" } | ConvertTo-Json) `
    -UseBasicParsing -ErrorAction Stop
  
  $loginData = $loginResponse.Content | ConvertFrom-Json
  Write-Output "Login response: $($loginData | ConvertTo-Json)"
  
  $token = $loginData.access_token
  Write-Output "Token obtained: $($token.Substring(0, 20))..."
  
  # Test creating assignment with the fresh token
  Write-Output "`nCreating test assignment..."
  
  $assignmentBody = @{
    title = "Test Multi-Question Assignment"
    description = "Testing new content structure"
    content = @{
      "Multiple Choice" = @{
        "RubricNote" = "Evaluate understanding of core concepts"
        "Question 1" = @{
          "What is a variable?" = @{
            "Result" = "A named storage location"
            "Answer" = ""
            "Points" = 5
          }
        }
        "Question 2" = @{
          "What is a function?" = @{
            "Result" = "A reusable block of code"
            "Answer" = ""
            "Points" = 5
          }
        }
      }
    }
    published_status = "draft"
  } | ConvertTo-Json -Depth 10
  
  $assignmentHeaders = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
    "X-Tenant-ID" = "550e8400-e29b-41d4-a716-446655440000"
  }
  
  $assignmentResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/courses/7aed68f7-a805-40e2-9d46-149bd379eb7f/assignments" `
    -Method POST `
    -Headers $assignmentHeaders `
    -Body $assignmentBody `
    -UseBasicParsing -ErrorAction Stop
  
  Write-Output "SUCCESS! Assignment created with status $($assignmentResponse.StatusCode)"
  Write-Output "Response:"
  $assignmentResponse.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3 | Write-Output
  
} catch {
  Write-Output "ERROR!"
  Write-Output "Exception: $($_.Exception.Message)"
  
  if ($_.Exception.Response) {
    Write-Output "Status Code: $($_.Exception.Response.StatusCode.Value)"
    $responseStream = $_.Exception.Response.GetResponseStream()
    $reader = [System.IO.StreamReader]::new($responseStream)
    $content = $reader.ReadToEnd()
    Write-Output "Response Body: $content"
  }
}
