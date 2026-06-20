# EventSync — System Design Document

**Version:** 1.0.0
**Backend Stack:** ASP.NET Core Web API (.NET 8), Entity Framework Core, MySQL (Aiven Cloud)
**Document Type:** Technical Reference / Academic Submission

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Backend Architecture](#2-backend-architecture)
3. [Authentication & Authorization System](#3-authentication--authorization-system)
4. [Core Modules](#4-core-modules)
   - [4.1 Event System](#41-event-system)
   - [4.2 Venue System](#42-venue-system)
   - [4.3 Notification System](#43-notification-system)
   - [4.4 Dashboard System](#44-dashboard-system)
   - [4.5 Audit Log System](#45-audit-log-system)
5. [API Layer Summary](#5-api-layer-summary)
6. [Database Design Overview](#6-database-design-overview)
7. [Data Flow Explanation](#7-data-flow-explanation)
8. [Error Handling & Validation](#8-error-handling--validation)
9. [File Upload System](#9-file-upload-system)

---

## 1. System Overview

**EventSync** is a web-based event scheduling and venue reservation system designed for use within an academic institution. It facilitates the proposal, review, approval, and tracking of student-organized events, with faculty members acting as approvers.

### Purpose

- Allow **students** to submit event proposals linked to specific venues and dates.
- Allow **faculty** to review, approve, or reject those proposals.
- Automatically notify users of event status changes and upcoming event reminders.
- Provide role-specific dashboards with aggregated event and venue statistics.
- Maintain a full audit trail of all system actions.

### Main Modules

| Module        | Responsibility                                                           |
|---------------|--------------------------------------------------------------------------|
| Auth          | Registration, login, JWT token issuance, refresh, and logout             |
| Event         | Event creation, status transitions (approve/reject/cancel), filtering    |
| Venue         | Venue creation, retrieval (with timeslot parsing), and deletion          |
| Notification  | Automated event notifications, preferences management                    |
| Dashboard     | Role-specific aggregated statistics and event lists                      |
| Audit Log     | Immutable action log capturing all significant system operations         |

### High-Level Architecture

```
Frontend (HTML/JS)
       │
       │  HTTP (REST)
       ▼
ASP.NET Core Web API
  ├── Controllers      ← HTTP layer (routing, auth extraction, delegation)
  ├── Services         ← Business logic (validation, DB operations, side effects)
  ├── Helpers          ← JWT generation utilities
  ├── DTOs             ← Strongly-typed request/response shapes
  └── AppDbContext     ← EF Core data access (MySQL via Pomelo)
       │
       ▼
  MySQL Database (Aiven Cloud)
```

---

## 2. Backend Architecture

### 2.1 Controllers (HTTP Layer)

Controllers are decorated with `[ApiController]` and `[Route]`. They:
- Extract identity information (user ID, role) from JWT claims via `ClaimTypes.NameIdentifier` and `ClaimTypes.Role`.
- Delegate all business logic to injected services.
- Return `Ok(result)` or `BadRequest(result)` based on the `GlobalResponse.Success` flag.

| Controller              | Route Prefix         | Injected Dependency |
|-------------------------|----------------------|----------------------|
| `AuthController`        | `api/auth`           | `AuthService`        |
| `EventController`       | `api/events`         | `EventService`       |
| `VenueController`       | `api/venues`         | `VenueService`       |
| `NotificationController`| `api/notifications`  | `NotificationService`|
| `DashboardController`   | `api/dashboard`      | `DashboardService`   |
| `AuditLogController`    | `api/auditlogs`      | `AppDbContext` (direct) |

> **Note:** `AuditLogController` is the only controller that queries `AppDbContext` directly, without a dedicated service layer.

### 2.2 Services (Business Logic Layer)

Services are registered as **Scoped** in `Program.cs` and contain all validation logic, database interaction, and side-effect orchestration.

| Service              | Dependencies                                         |
|----------------------|------------------------------------------------------|
| `AuthService`        | `AppDbContext`, `IPasswordHasher<User>`, `JwtGenerator`, `AuditLogService` |
| `EventService`       | `AppDbContext`, `NotificationService`, `AuditLogService` |
| `VenueService`       | `AppDbContext`, `AuditLogService`                    |
| `NotificationService`| `AppDbContext`, `AuditLogService`                    |
| `DashboardService`   | `AppDbContext`                                       |
| `AuditLogService`    | `AppDbContext`, `IHttpContextAccessor`               |
| `ReminderService`    | `IServiceProvider` (resolves `NotificationService` at runtime) |

### 2.3 AppDbContext (Data Access Layer)

`AppDbContext` extends EF Core's `DbContext` and exposes the following `DbSet<T>` properties:

```csharp
DbSet<User>                   Users
DbSet<Event>                  Events
DbSet<Venue>                  Venues
DbSet<Notification>           Notifications
DbSet<NotificationPreference> NotificationPreferences
DbSet<AuditLog>               AuditLogs
```

Queries use LINQ. EF Core translates LINQ expressions to SQL via the **Pomelo.EntityFrameworkCore.MySql** provider. The connection string is read from `ConnectionStrings:DefaultConnection` in `appsettings.json`.

### 2.4 DTOs (Data Transfer Layer)

DTOs are plain C# classes used to type request bodies and response payloads. They are never exposed directly to the database layer.

| DTO Class                          | Used As       | Module          |
|------------------------------------|---------------|-----------------|
| `AuthRegisterRequest`              | Request body  | Auth            |
| `AuthLoginRequest`                 | Request body  | Auth            |
| `AuthRefreshRequest`               | Request body  | Auth            |
| `AuthDataObjectResponse`           | Response data | Auth            |
| `EventCreateRequest`               | Request body  | Event           |
| `EventStatusUpdateRequest`         | Request body  | Event           |
| `EventResponseDto`                 | Response data | Event           |
| `VenueCreateDto`                   | Request body  | Venue           |
| `VenueResponseDto`                 | Response data | Venue           |
| `NotificationUpdatePreferenceDto`  | Request body  | Notification    |
| `DashboardStudentResponseDto`      | Response data | Dashboard       |
| `DashboardFacultyResponseDto`      | Response data | Dashboard       |
| `GlobalResponse`                   | All responses | Global          |

### 2.5 Global Response Wrapper

All API responses use the `GlobalResponse` DTO:

```csharp
public class GlobalResponse
{
    public bool    Success        { get; set; } = false;
    public string  BackendMessage { get; set; } = string.Empty;
    public object? Data           { get; set; }
}
```

The `Data` field is nullable. `null` values are omitted in serialized JSON due to `JsonIgnoreCondition.WhenWritingNull`. JSON is serialized in **camelCase** (`JsonNamingPolicy.CamelCase`). Circular reference cycles are handled via `ReferenceHandler.IgnoreCycles`.

### 2.6 Dependency Injection Registration (`Program.cs`)

```csharp
// Scoped services (one instance per HTTP request)
builder.Services.AddScoped<AuditLogService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<JwtGenerator>();
builder.Services.AddScoped<EventService>();
builder.Services.AddScoped<VenueService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddScoped<ReminderService>();
builder.Services.AddScoped<DashboardService>();

// HttpContextAccessor (needed by AuditLogService)
builder.Services.AddHttpContextAccessor();

// EF Core with MySQL
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));
```

> **Note:** `ReminderService` extends `BackgroundService` but is registered as **Scoped**, not `AddHostedService`. It resolves `NotificationService` at runtime through `IServiceProvider.CreateScope()`.

### 2.7 Middleware Pipeline Order (`Program.cs`)

```
app.UseCors("AllowAll")         ← CORS: AllowAnyOrigin, AllowAnyMethod, AllowAnyHeader
app.UseAuthentication()         ← JWT Bearer validation
app.UseAuthorization()          ← Role-based policy enforcement
app.UseStaticFiles(...)         ← Serves /Uploads/** as static files at /Uploads
app.MapControllers()            ← Routes HTTP requests to controllers
```

---

## 3. Authentication & Authorization System

### 3.1 JWT Authentication Flow

1. Client sends `POST /api/auth/login` with `studentNumber` or `username` + `password`.
2. `AuthService.Login` looks up the user by identifier.
3. Password is verified using `IPasswordHasher<User>.VerifyHashedPassword`.
4. On success, `JwtGenerator.AccessToken(user)` generates a signed JWT.
5. `JwtGenerator.RefreshToken()` generates a 96-byte cryptographically random refresh token (Base64-encoded).
6. The refresh token and its expiry (`DateTime.UtcNow.AddDays(7)`) are persisted to `Users.RefreshToken` and `Users.RefreshTokenExpiry`.
7. Response returns both tokens inside an `AuthDataObjectResponse`.

### 3.2 Token Generation (`JwtGenerator`)

**Access Token** — `JwtGenerator.AccessToken(user)`

```
Algorithm : HmacSha256
Issuer    : Jwt:Issuer (appsettings)
Audience  : Jwt:Audience (appsettings)
Expiry    : Jwt:ExpiryMinutes from now (60 minutes in development)
```

**Claims embedded in the token:**

| Claim Type                   | Value                  |
|------------------------------|------------------------|
| `ClaimTypes.NameIdentifier`  | `user.UserId.ToString()` |
| `ClaimTypes.Name`            | `user.FullName`        |
| `ClaimTypes.Role`            | `user.Role`            |

**Refresh Token** — `JwtGenerator.RefreshToken()`

- 96 random bytes from `RandomNumberGenerator.GetBytes(96)`, converted to Base64.
- Stored in the `Users` table alongside its expiry (7 days from issuance).

### 3.3 Token Refresh Flow

Endpoint: `POST /api/auth/refresh` — requires a valid (not expired) access token.

1. Controller extracts `userId` from `ClaimTypes.NameIdentifier`.
2. `AuthService.Refresh` fetches the user by ID.
3. Validates that `user.RefreshToken == req.RefreshToken`.
4. Validates that `user.RefreshTokenExpiry > DateTime.UtcNow`.
5. Rotates both tokens: generates new access token and new refresh token.
6. Persists updated refresh token and new 7-day expiry.

### 3.4 Logout

Endpoint: `POST /api/auth/logout` — requires a valid access token.

1. Controller extracts `userId` from the JWT.
2. `AuthService.Logout` sets `user.RefreshToken = null` and `user.RefreshTokenExpiry = null`.
3. The stored refresh token is invalidated server-side.

### 3.5 JWT Validation Parameters (`Program.cs`)

| Parameter                | Value                          |
|--------------------------|--------------------------------|
| `ValidateIssuer`         | `true`                         |
| `ValidateAudience`       | `true`                         |
| `ValidateLifetime`       | `true`                         |
| `ValidateIssuerSigningKey` | `true`                       |
| `ValidIssuer`            | `Jwt:Issuer` (appsettings)     |
| `ValidAudience`          | `Jwt:Audience` (appsettings)   |
| `IssuerSigningKey`       | SymmetricSecurityKey (UTF8 key)|

### 3.6 Role-Based Authorization

Roles are embedded as a claim in the JWT. Two roles exist in the system: `student` and `faculty`.

| Endpoint                     | Authorization Rule                    |
|------------------------------|---------------------------------------|
| `POST /api/events`           | `[Authorize(Roles = "student")]`      |
| `POST /api/venues`           | `[Authorize(Roles = "faculty")]`      |
| `DELETE /api/venues/{id}`    | `[Authorize(Roles = "faculty")]`      |
| `GET /api/auditlogs`         | `[Authorize(Roles = "faculty")]`      |
| All other protected endpoints| `[Authorize]` — any authenticated user|

Role-specific logic within shared endpoints (e.g., `GET /api/events`, `PATCH /api/events/{id}/status`) is enforced inside the service by reading the role from the claim and applying different database queries or return conditions.

---

## 4. Core Modules

### 4.1 Event System

**Service:** `EventService`  
**Controller:** `EventController` (`api/events`)

#### Event Creation Flow

1. Student calls `POST /api/events` with a `multipart/form-data` body (`EventCreateRequest`).
2. `EventService.CreateEvent`:
   a. Checks for venue/date/timeslot conflicts: queries `Events` where `VenueId`, `EventDate.Date`, `StartTime`, and `Status == "approved"` all match. Returns a conflict error if any exist.
   b. Saves the submitted letter file to `Uploads/Events/Letters/<Guid>.<ext>`.
   c. Creates an `Event` record with `Status = "pending"`, `FacultyId = null`, `OrganizerId = studentId`, and `CreatedAt = DateTime.Now`.
   d. Logs the creation via `AuditLogService.LogAsync`.

#### Event Retrieval

`GET /api/events?status={status}` — behavior differs by role:

- **Student:** Returns only events where `OrganizerId == userId` and `Status == status`.
- **Faculty (pending):** Returns all events system-wide with `Status == "pending"`.
- **Faculty (approved/rejected):** Returns events where `FacultyId == userId` and `Status == status`.
- **Faculty (cancelled):** Returns an error — faculty cannot view cancelled events.

Each event record includes the `Organizer` navigation property via `.Include(e => e.Organizer)`.

#### Event Approval/Rejection Flow (Faculty)

1. Faculty calls `PATCH /api/events/{id}/status` with `{ "status": "approved" | "rejected", "reason": "..." }`.
2. `EventService.UpdateEventStatus`:
   a. Validates the event exists and that the target status differs from current.
   b. If approving, re-checks venue/date/timeslot conflicts before committing.
   c. Sets `Status`, `FacultyId = userId`, and `Reason`.
   d. Saves changes.
   e. Logs the approval/rejection via `AuditLogService`.
   f. Calls `NotificationService.NotifyOnStatusChange` to notify the organizer.

#### Event Cancellation Flow (Student)

1. Student calls `PATCH /api/events/{id}/status` with `{ "status": "cancelled", "reason": "..." }`.
2. `EventService.UpdateEventStatus`:
   a. Validates the role is `student` and the target status is `cancelled`.
   b. Allows cancellation only when current status is `pending` or `approved`.
   c. Sets `Status = "cancelled"` and `Reason`.
   d. Saves changes.
   e. Logs the cancellation via `AuditLogService`.
   f. If the event was previously `approved`, calls `NotificationService.NotifyOnStatusChange` to notify the assigned faculty.

#### Business Rules

- An event can only transition: `pending → approved`, `pending → rejected`, `pending → cancelled`, `approved → cancelled`.
- No two approved events can share the same `VenueId`, `EventDate`, and `StartTime`.
- Faculty cannot cancel events; students cannot approve or reject.
- Faculty cannot view cancelled events via `GET /api/events?status=cancelled`.
- Events are created with `Status = "pending"` and `FacultyId = null` by default.

---

### 4.2 Venue System

**Service:** `VenueService`  
**Controller:** `VenueController` (`api/venues`)

#### Venue Retrieval

`GET /api/venues` or `GET /api/venues?status={status}`:
- If `status` query param is `null`: returns all venues.
- If `status` is provided: filters by `Venue.Status`.
- **Timeslot deserialization:** `Venue.TimeSlots` is stored in the database as a comma-separated string (e.g., `"8:00-11:00,13:00-15:00"`). On retrieval, `VenueService.GetVenues` splits this string into a `List<string>` before returning.
- **Facilities deserialization:** `Venue.Facilities` is similarly stored as a comma-separated string and split and trimmed on retrieval.
- Returns 404 (via `NotFound`) if no venues found.

#### Venue Creation (Faculty only)

`POST /api/venues` — `multipart/form-data`, `[Authorize(Roles = "faculty")]`:
1. `VenueService.AddVenue` optionally processes `PhotoCover` (an `IFormFile`).
2. If provided, photo is saved to `Uploads/Venue/Banners/<Guid>.<ext>`.
3. `VenueCreateDto.Timeslots` (a `List<string>`) is joined with commas before being stored in `Venue.TimeSlots`.
4. New venue is created with `Status = "available"`.
5. Logs the creation via `AuditLogService`.

#### Venue Deletion (Faculty only)

`DELETE /api/venues/{id}` — `[Authorize(Roles = "faculty")]`:
1. Checks if the venue exists.
2. **Guard:** Checks if any non-cancelled, non-rejected events exist for this venue. If so, deletion is blocked with an error message.
3. If the venue has a `PhotoPath`, the physical file is deleted from disk.
4. Removes the venue from the database.
5. Logs the deletion via `AuditLogService`.

---

### 4.3 Notification System

**Service:** `NotificationService`  
**Background Service:** `ReminderService`  
**Controller:** `NotificationController` (`api/notifications`)

#### Notification Creation Triggers

Notifications are **never created manually by users**. They are created by the system in two ways:

**1. On Event Status Change (`NotifyOnStatusChange`)**

Called by `EventService.UpdateEventStatus` after a status transition:

- **Faculty approves/rejects → Student notified:**
  - `approved`: `"Your event '{title}' has been approved!"`
  - `rejected` (with reason): `"Your event '{title}' was rejected. Reason: {reason}"`
  - `rejected` (no reason): `"Your event '{title}' was rejected."`
  - Before notifying, checks `NotificationPreference.NotifyOnStatusChange` for the organizer. If `false`, skips.

- **Student cancels an approved event → Faculty notified:**
  - Notifies `event.FacultyId` (only if non-null): `"The event '{title}' by '{organizerId}' was cancelled..."`
  - No preference check is performed for faculty cancellation notifications.

**2. Upcoming Event Reminders (`NotifyUpcomingEvents`)**

Called by `ReminderService` every **1 hour** via a `PeriodicTimer`:

1. Fetches all approved events.
2. For each event, loads the organizer's `NotificationPreference`.
3. If `timeToEvent.TotalHours` is between 23 and 25 and `NotifyOneDayBefore` is `true`: sends a "tomorrow" reminder.
4. If `timeToEvent.TotalDays` is between 6 and 8 and `NotifyOneWeekBefore` is `true`: sends a "one week" reminder.
5. If the organizer has no `NotificationPreference` record at all, they receive no reminders.

#### Notification Management Endpoints

| Action                       | Method | Endpoint                               |
|------------------------------|--------|----------------------------------------|
| Get all notifications        | GET    | `/api/notifications`                   |
| Mark single notification read| POST   | `/api/notifications/{id}/read`         |
| Mark all notifications read  | POST   | `/api/notifications/read-all`          |
| Get preferences              | GET    | `/api/notifications/preferences`       |
| Update preferences           | PUT    | `/api/notifications/preferences`       |

- `GetAll` fetches all `Notification` records where `UserId == userId`, ordered by `CreatedAt DESC`.
- `MarkAsRead` sets `IsRead = true` on a single notification by ID.
- `MarkAllAsRead` sets `IsRead = true` on all unread notifications (`IsRead == false`) for the user.
- `UpdatePreference` overwrites all three preference flags (`NotifyOneDayBefore`, `NotifyOneWeekBefore`, `NotifyOnStatusChange`) and logs the update via `AuditLogService`.

---

### 4.4 Dashboard System

**Service:** `DashboardService`  
**Controller:** `DashboardController` (`api/dashboard`)

Single endpoint: `GET /api/dashboard` — response shape is role-dependent.

> **Important:** `DashboardService.Get` compares `userRole` with the string `"Student"` and `"Faculty"` (capitalized). The JWT claim, however, stores the role exactly as set during registration (e.g., `"student"` lowercase). If there is a case mismatch between what is stored and what the service checks, the dashboard will return `"Invalid user role"`. This is a known behavior derived directly from the code.

#### Student Dashboard (`DashboardStudentResponseDto`)

| Field                | Query                                                      |
|----------------------|------------------------------------------------------------|
| `ProposedEvents`     | COUNT of events where `OrganizerId == userId`              |
| `PendingApproval`    | COUNT of events where `OrganizerId == userId` AND `Status == "pending"` |
| `AvailableVenues`    | COUNT of venues where `Status == "available"`              |
| `CancelledEvents`    | COUNT of events where `OrganizerId == userId` AND `Status == "cancelled"` |
| `MySubmittedEvents`  | All events where `OrganizerId == userId`                   |

#### Faculty Dashboard (`DashboardFacultyResponseDto`)

| Field                 | Query                                                         |
|-----------------------|---------------------------------------------------------------|
| `TotalActiveEvents`   | COUNT of events where `FacultyId == userId` AND `Status == "approved"` |
| `PendingApproval`     | COUNT of all events system-wide where `Status == "pending"`  |
| `AvailableVenuesToday`| COUNT of venues where `Status == "available"`                |
| `RejectedEvents`      | COUNT of events where `FacultyId == userId` AND `Status == "rejected"` |
| `TrackedEvents`       | Events where `Status == "ongoing"`, OR (`FacultyId == userId` AND `Status` is `"approved"` or `"rejected"`) |

---

### 4.5 Audit Log System

**Service:** `AuditLogService`  
**Controller:** `AuditLogController` (`api/auditlogs`)

`AuditLogService.LogAsync` is called by `AuthService`, `EventService`, `VenueService`, and `NotificationService` after every significant action.

#### Log Entry Fields

| Field            | Source                                                                |
|------------------|-----------------------------------------------------------------------|
| `Timestamp`      | `DateTime.UtcNow` at log time                                         |
| `UserId`         | Passed explicitly, or auto-populated from `ClaimTypes.NameIdentifier` |
| `UserIdentifier` | Passed explicitly, or fetched from DB (`Username` for faculty, `StudentNumber` for student) |
| `UserFullName`   | Passed explicitly, or auto-populated from `ClaimTypes.Name`           |
| `Role`           | Passed explicitly, or auto-populated from `ClaimTypes.Role`           |
| `IpAddress`      | `httpContext.Connection.RemoteIpAddress`, defaults to `"127.0.0.1"`   |
| `ObjectType`     | String descriptor of what was acted on (`"Auth"`, `"Event"`, `"Venue"`, `"NotificationPreference"`) |
| `Action`         | String descriptor of what happened (`"Register"`, `"Login"`, `"Create"`, `"Approve"`, etc.) |
| `ObjectName`     | The name or identifier of the affected object                         |
| `Url`            | `httpContext.Request.Path.Value`                                       |

#### Audit Log Retrieval

`GET /api/auditlogs` — accessible only by `[Authorize(Roles = "faculty")]`.

Returns all `AuditLog` records ordered by `Timestamp DESC`, wrapped in a `GlobalResponse`.

#### Startup Data Cleanup

On application startup, `Program.cs` runs a raw SQL query to backfill any `AuditLog` entries where `UserFullName = "Anonymous"` (legacy records) with the actual user's name and identifier from the `Users` table.

---

## 5. API Layer Summary

### Auth Module (`api/auth`)

| Method | Endpoint              | Access       | Request Body              | Response                          |
|--------|-----------------------|--------------|---------------------------|-----------------------------------|
| POST   | `/api/auth/register`  | `[AllowAnonymous]` | `AuthRegisterRequest` | `GlobalResponse`             |
| POST   | `/api/auth/login`     | `[AllowAnonymous]` | `AuthLoginRequest`    | `GlobalResponse` with `AuthDataObjectResponse` |
| POST   | `/api/auth/refresh`   | `[Authorize]`      | `AuthRefreshRequest`  | `GlobalResponse` with `AuthDataObjectResponse` |
| POST   | `/api/auth/logout`    | `[Authorize]`      | _(none)_              | `GlobalResponse`                  |

### Event Module (`api/events`)

| Method | Endpoint                        | Access                   | Request Body                | Response                      |
|--------|---------------------------------|--------------------------|-----------------------------|-------------------------------|
| GET    | `/api/events?status={status}`   | `[Authorize]`            | Query param `status`        | `GlobalResponse` with `List<Event>` |
| POST   | `/api/events`                   | `[Authorize(Roles="student")]` | `EventCreateRequest` (form) | `GlobalResponse` with `Event` |
| PATCH  | `/api/events/{id}/status`       | `[Authorize]`            | `EventStatusUpdateRequest`  | `GlobalResponse`              |

### Venue Module (`api/venues`)

| Method | Endpoint            | Access                    | Request Body           | Response                      |
|--------|---------------------|---------------------------|------------------------|-------------------------------|
| GET    | `/api/venues`       | `[Authorize]`             | Query param `status?`  | `GlobalResponse` with venue list (parsed timeslots/facilities) |
| POST   | `/api/venues`       | `[Authorize(Roles="faculty")]` | `VenueCreateDto` (form) | `GlobalResponse` with `Venue` |
| DELETE | `/api/venues/{id}`  | `[Authorize(Roles="faculty")]` | _(none)_           | `GlobalResponse`              |

### Notification Module (`api/notifications`)

| Method | Endpoint                              | Access        | Request Body                      | Response         |
|--------|---------------------------------------|---------------|-----------------------------------|------------------|
| GET    | `/api/notifications`                  | `[Authorize]` | _(none)_                          | `GlobalResponse` with `List<Notification>` |
| POST   | `/api/notifications/{id}/read`        | `[Authorize]` | _(none)_                          | `GlobalResponse` |
| POST   | `/api/notifications/read-all`         | `[Authorize]` | _(none)_                          | `GlobalResponse` |
| GET    | `/api/notifications/preferences`      | `[Authorize]` | _(none)_                          | `GlobalResponse` with `NotificationPreference` |
| PUT    | `/api/notifications/preferences`      | `[Authorize]` | `NotificationUpdatePreferenceDto` | `GlobalResponse` |

### Dashboard Module (`api/dashboard`)

| Method | Endpoint         | Access        | Request Body | Response                                        |
|--------|------------------|---------------|--------------|-------------------------------------------------|
| GET    | `/api/dashboard` | `[Authorize]` | _(none)_     | `GlobalResponse` with `DashboardStudentResponseDto` or `DashboardFacultyResponseDto` |

### Audit Log Module (`api/auditlogs`)

| Method | Endpoint         | Access                      | Request Body | Response                            |
|--------|------------------|-----------------------------|--------------|-------------------------------------|
| GET    | `/api/auditlogs` | `[Authorize(Roles="faculty")]` | _(none)_ | `GlobalResponse` with `List<AuditLog>` |

---

## 6. Database Design Overview

The database is MySQL, managed through Entity Framework Core with code-first migrations.

### Entities and Fields

#### `Users`

| Column                | Type         | Constraints               |
|-----------------------|--------------|---------------------------|
| `UserId`              | `int`        | PK, auto-increment        |
| `FullName`            | `string?`    | Nullable                  |
| `PasswordHash`        | `string`     | Not null                  |
| `Role`                | `string`     | Not null (`"student"` or `"faculty"`) |
| `StudentNumber`       | `string?`    | Nullable (student only)   |
| `Username`            | `string?`    | Nullable (faculty only)   |
| `RefreshToken`        | `string?`    | Nullable                  |
| `RefreshTokenExpiry`  | `DateTime?`  | Nullable                  |
| `CreatedAt`           | `DateTime`   | Not null                  |

#### `Events`

| Column              | Type        | Constraints                              |
|---------------------|-------------|------------------------------------------|
| `EventId`           | `int`       | PK, auto-increment                       |
| `OrganizerId`       | `int`       | FK → `Users.UserId`, Not null            |
| `FacultyId`         | `int?`      | FK → `Users.UserId`, Nullable            |
| `VenueId`           | `int`       | FK → `Venues.VenueId`, Not null          |
| `Title`             | `string`    | Not null                                 |
| `Department`        | `string`    | Not null                                 |
| `EventDate`         | `DateTime`  | Not null                                 |
| `StartTime`         | `TimeOnly`  | Not null                                 |
| `ExpectedAttendees` | `int`       | Not null                                 |
| `SubmitLetterPath`  | `string`    | Not null                                 |
| `Status`            | `string`    | Not null (`pending`, `approved`, `rejected`, `cancelled`) |
| `Reason`            | `string?`   | Nullable                                 |
| `CreatedAt`         | `DateTime`  | Not null                                 |
| `UpdatedAt`         | `DateTime?` | Nullable                                 |

#### `Venues`

| Column         | Type      | Constraints                                          |
|----------------|-----------|------------------------------------------------------|
| `VenueId`      | `int`     | PK, auto-increment                                   |
| `Name`         | `string`  | Not null                                             |
| `Address`      | `string`  | Not null                                             |
| `Capacity`     | `int`     | Not null                                             |
| `Description`  | `string`  | Not null                                             |
| `Availability` | `string`  | Not null (human-readable schedule string)            |
| `TimeSlots`    | `string?` | Nullable; stored as comma-separated string           |
| `Status`       | `string`  | Not null (`"available"` or other)                    |
| `PhotoPath`    | `string?` | Nullable; relative file path                         |
| `Facilities`   | `string`  | Not null; stored as comma-separated string           |

#### `Notifications`

| Column           | Type       | Constraints                  |
|------------------|------------|------------------------------|
| `NotificationId` | `int`      | PK, auto-increment           |
| `UserId`         | `int`      | FK → `Users.UserId`, Not null|
| `EventId`        | `int`      | FK → `Events.EventId`, Not null |
| `Message`        | `string`   | Not null                     |
| `IsRead`         | `bool`     | Default `false`              |
| `CreatedAt`      | `DateTime` | Not null                     |

#### `NotificationPreferences`

| Column                      | Type       | Constraints                  |
|-----------------------------|------------|------------------------------|
| `NotificationPreferenceId`  | `int`      | PK, auto-increment           |
| `UserId`                    | `int`      | FK → `Users.UserId`, Not null|
| `NotifyOneDayBefore`        | `bool`     | Default `true`               |
| `NotifyOneWeekBefore`       | `bool`     | Default `true`               |
| `NotifyOnStatusChange`      | `bool`     | Default `true`               |
| `LastUpdated`               | `DateTime` | Not null                     |

#### `AuditLogs`

| Column           | Type       | Constraints               |
|------------------|------------|---------------------------|
| `AuditLogId`     | `int`      | PK, auto-increment        |
| `Timestamp`      | `DateTime` | Not null (`DateTime.UtcNow`) |
| `UserId`         | `int?`     | Nullable                  |
| `UserIdentifier` | `string`   | Default `"Anonymous"`     |
| `UserFullName`   | `string`   | Default `"Anonymous"`     |
| `Role`           | `string`   | Default `"Anonymous"`     |
| `IpAddress`      | `string`   | Not null                  |
| `ObjectType`     | `string`   | Not null                  |
| `Action`         | `string`   | Not null                  |
| `ObjectName`     | `string`   | Not null                  |
| `Url`            | `string`   | Not null                  |

### Entity Relationships

```
Users (1) ────────────── (N) Events [as Organizer]
Users (1) ────────────── (N) Events [as Faculty, nullable]
Venues (1) ─────────────(N) Events
Users (1) ────────────── (N) Notifications
Events (1) ─────────────(N) Notifications
Users (1) ────────────── (1) NotificationPreferences
```

All relationships use integer foreign keys. EF Core navigation properties are nullable (`User?`, `Venue?`, `Event?`) to support lazy-load-free querying.

---

## 7. Data Flow Explanation

### Example 1: Creating an Event

```
Student Client
  │
  ├─ POST /api/events (multipart/form-data: title, venueId, eventDate, startTime, expectedAttendees, submitLetter file)
  │
  ▼
EventController.Create()
  ├─ Extracts studentId from ClaimTypes.NameIdentifier
  ├─ Validates role is "student" via [Authorize(Roles = "student")]
  └─ Calls EventService.CreateEvent(req, studentId)
         │
         ├─ Queries Events WHERE VenueId == req.VenueId AND EventDate == req.EventDate AND StartTime == req.StartTime AND Status == "approved"
         │    └─ If conflict → return GlobalResponse { Success = false, ... }
         │
         ├─ Saves file to Uploads/Events/Letters/<Guid>.<ext>
         ├─ Creates Event entity, Status = "pending"
         ├─ _dbContext.Events.Add(newEvent); _dbContext.SaveChangesAsync()
         ├─ AuditLogService.LogAsync(..., "Event", "Create", newEvent.Title)
         └─ return GlobalResponse { Success = true, Data = newEvent }
  │
EventController returns Ok(result) → HTTP 200
```

### Example 2: Approving an Event

```
Faculty Client
  │
  ├─ PATCH /api/events/{id}/status (body: { "status": "approved" })
  │
  ▼
EventController.UpdateStatus()
  ├─ Extracts userId and userRole from JWT claims
  └─ Calls EventService.UpdateEventStatus(id, userId, "faculty", req)
         │
         ├─ Fetches Event by EventId
         ├─ Validates current status != req.Status
         ├─ Validates role == "faculty" and current status is "pending"
         ├─ If approving: re-checks venue conflict (same venue/date/time already approved)
         ├─ Sets Status = "approved", FacultyId = userId
         ├─ _dbContext.SaveChangesAsync()
         ├─ AuditLogService.LogAsync(..., "Event", "Approve", event.Title)
         └─ NotificationService.NotifyOnStatusChange(event, reason, "faculty")
                  │
                  ├─ Loads organizer's NotificationPreference
                  ├─ If NotifyOnStatusChange == false → skip
                  └─ SaveNotification(organizerId, eventId, "Your event '...' has been approved!")
  │
EventController returns Ok(result) → HTTP 200
```

### Example 3: Fetching Venues

```
Authenticated Client
  │
  ├─ GET /api/venues?status=available
  │
  ▼
VenueController.GetVenues(status = "available")
  └─ Calls VenueService.GetVenues("available")
         │
         ├─ Queries Venues WHERE Status == "available"
         ├─ Projects each venue:
         │    ├─ Splits TimeSlots by "," → List<string>
         │    └─ Splits Facilities by "," and trims → List<string>
         └─ return GlobalResponse { Success = true, Data = projectedVenues }
  │
VenueController returns Ok(result) → HTTP 200
```

---

## 8. Error Handling & Validation

### Validation in Services

All validation is performed inside service methods and returned as `GlobalResponse { Success = false, BackendMessage = "..." }`. The controller then returns `BadRequest(result)`.

#### `AuthService` Validation Rules

| Rule                                             | Error Message                                             |
|--------------------------------------------------|-----------------------------------------------------------|
| Student number not exactly 10 characters        | `"Student Number must be exactly 10 characters long"`     |
| Identifier already exists in DB                  | `"User already registered"`                               |
| Invalid or missing role                          | `"Invalid Role"`                                          |
| Identifier contains spaces                       | `"Username and Student Number may not contain spaces"`    |
| Identifier shorter than 8 characters            | `"Username and Student Number must be at least 8 characters long"` |
| Identifier longer than 20 characters            | `"Username and Student Number may only be 20 characters long"` |
| Password shorter than 8 or longer than 20 chars | `"Password must be at least 8 characters long and at most 20 characters long"` |
| User not found (login)                           | `"User not found"`                                        |
| Incorrect password                               | `"Incorrect password"`                                    |
| Invalid or expired refresh token                 | `"Invalid refresh token"` / `"Refresh token expired"`     |

#### `EventService` Validation Rules

| Rule                                               | Error Message                                                           |
|----------------------------------------------------|-------------------------------------------------------------------------|
| Missing status query param                         | `"Status is required for filtering events."`                            |
| No events found                                    | `"No events found."`                                                    |
| Venue conflict on creation                         | `"This venue is already booked for the selected date and time slot."`   |
| Invalid event ID                                   | `"Invalid Event ID."`                                                   |
| Status is already the same                         | `"Event is already {status}. Cannot update."`                           |
| Faculty tries to approve already-approved venue slot| `"Cannot approve this event because another event has already been approved..."` |
| Faculty tries invalid status transition            | `"Faculty cannot update the Event's status to {status} because it is already {current}."`  |
| Student tries non-cancel transition                | `"Student cannot update the Event's status to {status} because it is already {current}."` |

#### `VenueService` Validation Rules

| Rule                                        | Error Message                                                                   |
|---------------------------------------------|---------------------------------------------------------------------------------|
| Venue not found (delete)                    | `"Venue not found."`                                                            |
| Active events prevent deletion              | `"Cannot delete venue because it has active events scheduled/associated with it."` |

### HTTP Response Codes Used

| Code  | When                                                                      |
|-------|---------------------------------------------------------------------------|
| `200` | Success (all controllers return `Ok(result)`)                             |
| `400` | Validation failure — `BadRequest(result)` returned by controller          |
| `401` | No or invalid JWT — `Unauthorized(...)` returned by controller            |
| `404` | Resource not found — used by `VenueController.GetVenues` only             |

### Exception Handling

No global exception middleware is configured. The only explicit `try/catch` is in `Program.cs` for the startup database cleanup SQL, which logs the error to the console and continues.

---

## 9. File Upload System

### Event Submission Letters

- **Triggered by:** `POST /api/events`
- **Field:** `EventCreateRequest.SubmitLetter` (`IFormFile`)
- **Storage directory:** `<CWD>/Uploads/Events/Letters/`
- **File naming convention:** `<Guid>.<original-extension>` (e.g., `3f2504e0-4f89-11d3-9a0c-0305e82c3301.pdf`)
- **DB storage:** The relative path `Uploads/Events/Letters/<filename>` is saved to `Event.SubmitLetterPath`.

### Venue Photo Covers

- **Triggered by:** `POST /api/venues`
- **Field:** `VenueCreateDto.PhotoCover` (`IFormFile?`) — optional
- **Storage directory:** `<CWD>/Uploads/Venue/Banners/`
- **File naming convention:** `<Guid>.<original-extension>`
- **DB storage:** The relative path `Uploads/Venue/Banners/<filename>` is saved to `Venue.PhotoPath`.
- **On deletion:** If `Venue.PhotoPath` is set and the file exists on disk, `File.Delete(filePath)` is called before the venue record is removed.

### Static File Serving

Files stored under `<CWD>/Uploads/**` are served as static files at the URL path `/Uploads/**`, configured in `Program.cs`:

```csharp
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(
        Path.Combine(Directory.GetCurrentDirectory(), "Uploads")),
    RequestPath = "/Uploads"
});
```

This means a file saved at `Uploads/Events/Letters/abc.pdf` is accessible via `GET /Uploads/Events/Letters/abc.pdf`.

---

*End of Document*