$loginBody = @{
  email = "teacher1@deepgrader.com"
  password = "Password123!"
} | ConvertTo-Json

$loginHeaders = @{
  "Content-Type" = "application/json"
}

try {
  Write-Output "Logging in..."
  $loginResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/auth/login" `
    -Method POST `
    -Headers $loginHeaders `
    -Body $loginBody -ErrorAction Stop
  
  Write-Output "Login successful!"
  $loginData = $loginResponse.Content | ConvertFrom-Json
  $token = $loginData.data.access_token
  Write-Output "Token: $token"
  
  # Now test creating assignment with the fresh token
  Write-Output "`nTesting assignment creation..."
  
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
    -Body $assignmentBody -ErrorAction Stop
  
  Write-Output "SUCCESS! Assignment created!"
  Write-Output "Status: $($assignmentResponse.StatusCode)"
  Write-Output "Response:"
  Write-Output ($assignmentResponse.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5)
  
} catch {
  Write-Output "ERROR!"
  Write-Output "Exception: $($_.Exception.Message)"
  
  if ($_.Exception.Response) {
    Write-Output "Status: $($_.Exception.Response.StatusCode.Value)"
    $responseStream = $_.Exception.Response.GetResponseStream()
    $reader = [System.IO.StreamReader]::new($responseStream)
    $content = $reader.ReadToEnd()
    Write-Output "Response Body:"
    Write-Output $content
  }
}
