$ErrorActionPreference = "Stop"

# Helper for REST calls
function Call-Api($uri, $method, $headers = $null, $body = $null, $contentType = "application/json") {
    $params = @{
        Uri = $uri
        Method = $method
    }
    if ($headers) { $params.Headers = $headers }
    if ($body) {
        $params.Body = $body
        $params.ContentType = $contentType
    }
    try {
        return Invoke-RestMethod @params
    } catch {
        if ($_.Exception -and $_.Exception.Response) {
            $streamReader = New-Object System.IO.StreamReader $_.Exception.Response.GetResponseStream()
            $errResp = $streamReader.ReadToEnd()
            Write-Host "API Request Failed with Body: $errResp"
        }
        throw $_
    }
}


# 0. Register Student & Faculty if they don't exist
Write-Host "Checking/Registering student user..."
$studentRegisterBody = @{
    studentNumber = "R2024-0123"
    fullName = "Test Student"
    password = "password123"
    role = "student"
} | ConvertTo-Json

try {
    Call-Api -uri "http://localhost:5108/api/auth/register" -method Post -body $studentRegisterBody | Out-Null
    Write-Host "Student registered successfully."
} catch {
    Write-Host "Student registration bypassed (likely already registered or other issue)."
}

Write-Host "Checking/Registering faculty user..."
$facultyRegisterBody = @{
    username = "prof.aguilar123"
    fullName = "Prof. Aguilar"
    password = "password123"
    role = "faculty"
} | ConvertTo-Json

try {
    Call-Api -uri "http://localhost:5108/api/auth/register" -method Post -body $facultyRegisterBody | Out-Null
    Write-Host "Faculty registered successfully."
} catch {
    Write-Host "Faculty registration bypassed (likely already registered or other issue)."
}

# 1. Login as Student (R2024-0123)
$studentLoginBody = @{
    studentNumber = "R2024-0123"
    password = "password123"
} | ConvertTo-Json

Write-Host "Logging in as student..."
$studentLoginRes = Call-Api -uri "http://localhost:5108/api/auth/login" -method Post -body $studentLoginBody
$studentToken = $studentLoginRes.data.accessToken
Write-Host "Student token obtained: $studentToken"

# 2. Login as Faculty (prof.aguilar123)
$facultyLoginBody = @{
    username = "prof.aguilar123"
    password = "password123"
} | ConvertTo-Json

Write-Host "Logging in as faculty..."
$facultyLoginRes = Call-Api -uri "http://localhost:5108/api/auth/login" -method Post -body $facultyLoginBody
$facultyToken = $facultyLoginRes.data.accessToken
Write-Host "Faculty token obtained: $facultyToken"


# 3. Submit two pending requests for the same slot
# Let's target VenueId = 1, Date = 2026-07-10, Time = 09:00 AM
# Since the backend creates events via multipart/form-data (IFormFile SubmitLetter is required),
# we need to construct a multipart form.
$studentHeaders = @{ Authorization = "Bearer $studentToken" }
$facultyHeaders = @{ Authorization = "Bearer $facultyToken" }

$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"
$filePath = "c:\Users\roger\Desktop\Test\EventSync\backend\Tests\test_files\sampol.pdf"
if (-not (Test-Path $filePath)) {
    # Try to find any pdf or text file to use as a dummy file
    $filePath = "c:\Users\roger\Desktop\Test\EventSync\backend\Program.cs"
}
$fileBytes = [System.IO.File]::ReadAllBytes($filePath)
$fileEnc = [System.Text.Encoding]::GetEncoding('iso-8859-1').GetString($fileBytes)

function Create-Event-Multipart($title, $venueId, $date, $time) {
    $bodyLines = (
        "--$boundary",
        "Content-Disposition: form-data; name=`"Title`"",
        "",
        $title,
        "--$boundary",
        "Content-Disposition: form-data; name=`"Department`"",
        "",
        "COE",
        "--$boundary",
        "Content-Disposition: form-data; name=`"VenueId`"",
        "",
        "$venueId",
        "--$boundary",
        "Content-Disposition: form-data; name=`"EventDate`"",
        "",
        $date,
        "--$boundary",
        "Content-Disposition: form-data; name=`"StartTime`"",
        "",
        $time,
        "--$boundary",
        "Content-Disposition: form-data; name=`"ExpectedAttendees`"",
        "",
        "50",
        "--$boundary",
        "Content-Disposition: form-data; name=`"SubmitLetter`"; filename=`"letter.pdf`"",
        "Content-Type: application/pdf",
        "",
        $fileEnc,
        "--$boundary--"
    ) -join $LF
    return $bodyLines
}

# Fetch available venues dynamically
Write-Host "Fetching available venues..."
$venuesRes = Call-Api -uri "http://localhost:5108/api/venues" -method Get -headers $studentHeaders
if ($venuesRes.data.Count -eq 0 -or $null -eq $venuesRes.data) {
    throw "No venues found in the database. Add a venue first or seed the database."
}
$targetVenueId = $venuesRes.data[0].venueId
Write-Host "Selected Venue ID: $targetVenueId ($($venuesRes.data[0].name))"

Write-Host "Creating first event request (Title: Event A)..."
$bodyA = Create-Event-Multipart "Event A" $targetVenueId "2026-07-10" "09:00:00"
$resA = Call-Api -uri "http://localhost:5108/api/events" -method Post -headers $studentHeaders -body $bodyA -contentType "multipart/form-data; boundary=$boundary"
$eventAId = $resA.data.eventId
Write-Host "First event created successfully with ID: $eventAId"

Write-Host "Creating second event request (Title: Event B, same venue/date/time)..."
$bodyB = Create-Event-Multipart "Event B" $targetVenueId "2026-07-10" "09:00:00"
# This should succeed since both are pending and no event is approved yet!
$resB = Call-Api -uri "http://localhost:5108/api/events" -method Post -headers $studentHeaders -body $bodyB -contentType "multipart/form-data; boundary=$boundary"
$eventBId = $resB.data.eventId
Write-Host "Second event created successfully with ID: $eventBId"


# 4. Approve Event A as Faculty
Write-Host "Approving Event A ($eventAId)..."
$approveBody = @{
    status = "approved"
    reason = "Approved event A"
} | ConvertTo-Json

$approveRes = Call-Api -uri "http://localhost:5108/api/events/$eventAId/status" -method Patch -headers $facultyHeaders -body $approveBody
Write-Host "Event A Approval response: $($approveRes.backendMessage)"

# 5. Try to approve Event B, which has a conflict now
Write-Host "Attempting to approve Event B ($eventBId)..."
try {
    $conflictBody = @{
        status = "approved"
        reason = "Try to approve event B"
    } | ConvertTo-Json
    $conflictRes = Call-Api -uri "http://localhost:5108/api/events/$eventBId/status" -method Patch -headers $facultyHeaders -body $conflictBody
    Write-Host "Warning: Double booking succeeded! Response: $($conflictRes.backendMessage)"
    exit 1
} catch {
    Write-Host "Successfully blocked double booking. Error details: $_"
}

# 6. Try to create a new event for the same slot (Event C) - should be rejected upon creation
Write-Host "Attempting to create Event C for the already booked slot..."
try {
    $bodyC = Create-Event-Multipart "Event C" $targetVenueId "2026-07-10" "09:00:00"
    $resC = Call-Api -uri "http://localhost:5108/api/events" -method Post -headers $studentHeaders -body $bodyC -contentType "multipart/form-data; boundary=$boundary"
    Write-Host "Warning: Creating event C for already booked slot succeeded! Response: $($resC.backendMessage)"
    exit 1
} catch {
    Write-Host "Successfully blocked creation for already booked slot. Error details: $_"
}

Write-Host "All backend checks verified successfully!"
