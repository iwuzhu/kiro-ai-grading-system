$body = @{
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

$headers = @{
  "Content-Type" = "application/json"
  "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzMzNlNDU2Ny1lODliLTEyZDMtYTQ1Ni00MjY2MTQxNzQwMDEiLCJlbWFpbCI6InRlYWNoZXIxQGRlZXBncmFkZXIuY29tIiwidGVuYW50X2lkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwIiwicm9sZSI6IklOU1RSVUNUT1IiLCJwZXJtaXNzaW9ucyI6WyJjb3Vyc2VzOmNyZWF0ZSIsImFzc2lnbm1lbnRzOm1hbmFnZSJdLCJpYXQiOjE3MjU0MDU0MzksImV4cCI6MTcyNTQwOTAzOX0.6NjJJlqqe-_LeCjQUX3OJ4kq4YC5ZKPdPyqJsqM_6Dg"
  "X-Tenant-ID" = "550e8400-e29b-41d4-a716-446655440000"
}

try {
  $response = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/courses/7aed68f7-a805-40e2-9d46-149bd379eb7f/assignments" `
    -Method POST `
    -Headers $headers `
    -Body $body -ErrorAction Stop
  
  Write-Output "SUCCESS! Status: $($response.StatusCode)"
  Write-Output "Response:"
  Write-Output ($response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5)
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
    if ($content) {
      Write-Output "Parsed JSON:"
      Write-Output ($content | ConvertFrom-Json | ConvertTo-Json -Depth 5)
    }
  }
}
