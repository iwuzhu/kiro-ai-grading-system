$uri = "http://localhost:3001/api/v1/auth/login"
$body = @{
    email = "admin@deepgrader.com"
    password = "Password123!"
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
}

Write-Host "Testing login endpoint..."
Write-Host "POST $uri"
Write-Host "Body: $body"
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri $uri -Method POST -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "✅ SUCCESS - HTTP $($response.StatusCode)"
    Write-Host ""
    Write-Host "Response:"
    $response.Content | ConvertFrom-Json | ConvertTo-Json | Write-Host
} catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    $responseBody = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($responseBody)
    $content = $reader.ReadToEnd()
    
    Write-Host "❌ FAILED - HTTP $statusCode"
    Write-Host ""
    Write-Host "Response:"
    Write-Host $content
}
