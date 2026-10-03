# Test auth endpoint
$body = @{
    email = "admin@deepgrader.com"
    password = "Password123!"
} | ConvertTo-Json

Write-Host "Testing POST http://localhost:3001/api/v1/auth/login"
Write-Host "Body: $body`n"

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/auth/login" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -SkipHttpErrorCheck
    
    Write-Host "Status Code: $($response.StatusCode)"
    Write-Host "Response:"
    $response.Content | ConvertFrom-Json | ConvertTo-Json
}
catch {
    Write-Host "Error: $($_.Exception.Message)"
}
