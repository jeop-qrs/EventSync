# API Contract - EventSync

**Version:** 1.1.0  
**Base URL:** `http://localhost:5108` (TBD)

---

## Common HTTP Status Codes

| Status | Meaning                                      | Method                             |
| ------ | -------------------------------------------- | ---------------------------------- |
| `200`  | Success + Payload (optional)                 | `return Ok(optionalmessage);`      |
| `201`  | Resource created                             | `return Created("", );`            |
| `204`  | Success + No message                         | `return NoContent();`              |
| `400`  | Bad Request — validation failed              | `return BadRequest(error);`        |
| `401`  | Unauthorized — not authenticated             | `return Unauthorized();`           |
| `403`  | Forbidden — authenticated but not allowed    | `return Forbid();`                 |
| `404`  | Not Found — resource doesn't exist           | `return NotFound();`               |
| `409`  | Conflict — duplicate or constraint violation | `return Conflict(message);`        |
| `500`  | Server Error — something broke on our end    | `return StatusCode(500, message);` |

---

## Legend - Access Level

| Symbol | Meaning                                     |
| ------ | ------------------------------------------- |
| [PUB]  | Public — no login/auth required             |
| [AUTH] | Protected — login needed/requires valid JWT |

---

## Roles Overview

| Role      | Who               | What they can do                                                                                                                                                |
| --------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `faculty` | Faculty member    | Approve or reject event and venue reservation requests, create venues, view all events and venues, edit event, cancel event, view dashboard, view notifications |
| `student` | Student organizer | Create events, reserve venues, view own requests, cancel event, view dashboard, manage notifications, view own notification, view all events and venues         |

---

## Response Pattern

**Response `123 nameOfHttpCode` (What role/s)**

```json
{
  "success": true or false,
  "backendMessage": "logs (why it worked or didn't work)",
  "data": null or {
    // All data needed by the frontend
    // Varies depending on service requested and the role of client
    // If `data` is null (usually when "success": false),
    // it will be omitted (JsonIgnoreCondition.WhenWritingNull)
  }
}
```

---

## Table of Contents

- [1. Authentication & Role Management](#1-authentication--role-management)
- [2. Event Scheduling](#2-event-scheduling)
- [3. Venue Reservation](#3-venue-reservation)
- [4. Notification System](#4-notification-system)
- [5. Dashboard Overview](#5-dashboard-overview)

---

## 1) Authentication & Role Management

> User can register to system with **student** or **faculty** roles.  
> Logging in gives Access Token.  
> Access token is used to access role-based services.

---

### [PUB] POST `/api/auth/register`

Register a new user account.

**Header**

```json
{
  "Content-Type": "application/json"
}
```

**Request Body**

```json
{
  "username": "juandelacruz",
  "password": "password123",
  "role": "student" | "faculty"
}
```

**Response `200 OK` (No roles)**

```json
{
  "success": true,
  "backendMessage": "Register successful. Log in again."
}
```

---

### [PUB] POST `/api/auth/login`

Authenticate a user and return JWT tokens.

**Header**

```json
{
  "Content-Type": "application/json"
}
```

**Request Body**

```json
{
  "username": "juandelacruz",
  "password": "password123"
}
```

**Response `200 OK` (No roles)**

```json
{
  "success": true,
  "backendMessage": "Login successful.",
  "data": {
    "studNo": "01234abc2026-B",
    "role": "student",
    "accessToken": "accessToken...",
    "expiresAt": 3599,
    "refreshToken": "refreshToken..."
  }
}
```

---

### [AUTH] POST `/api/auth/refresh`

Rotate the accessToken and refreshToken (generate new tokens).  
Must automatically trigger when client's current access token expired.

**Header**

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer accessToken..."
}
```

**Request Body**

```json
{
  "refreshToken": "refreshToken..."
}
```

**Response `200 OK` (All roles)**

```json
{
  "success": true,
  "backendMessage": "Token refreshed.",
  "data": {
    "studNo": "01234abc2026-B",
    "role": "student",
    "accessToken": "accessToken...",
    "expiresAt": 3599,
    "refreshToken": "refreshToken..."
  }
}
```

---

### [AUTH] POST `/api/auth/logout`

Invalidate the current session and stored refresh token.

**Header**

```json
{
  "Authorization": "Bearer accessToken..."
}
```

**Response `200 OK` (All roles)**

```json
{
  "success": true,
  "backendMessage": "Logout successful."
}
```

---

### [PUB] POST `/api/auth/forgot-password` (Inactive)

Send a password reset link to the user's email.

---

### [PUB] POST `/api/auth/reset-password` (Inactive)

Reset password using token from the email link.

---

### [PUB] POST `/api/auth/verify-email` (Inactive)

Verify user's email address using the token sent on registration.

---

## 2) Event Scheduling

> Events are created by **Students** as reservation requests.  
> **Faculty** reviews and approves or rejects them.

---

### [AUTH] GET `/api/event`

Get all events (approved, rejected, cancelled, pending, etc.).

**Header**

```json
{
  "Authorization": "Bearer accessToken..."
}
```

**Response `200 OK` (All roles)**

```json
{
  "success": true,
  "backendMessage": "Events fetched.",
  "data": {
    "events": [
      {
        "eventId": 1,
        "organizerId": 1,
        "title": "Introduction to C#",
        "description": "Learn the basics of C# programming.",
        "startDateTime": "2026-01-01T00:00:00Z",
        "endDateTime": "2026-01-01T00:00:00Z",
        "expectedAttendees": 100,
        "status": "pending | approved | rejected | cancelled",
        "reason": "reason" or null,
        "createdAt": "2022-01-01T00:00:00Z",
        "updatedAt": "2022-01-01T00:00:00Z"
      },
      {
        "eventId": 2,
        "organizerId": 2,
        "title": "Introduction to Javascript",
        "description": "Learn the basics of Javascript programming.",
        "startDateTime": "2026-03-01T00:00:00Z",
        "endDateTime": "2026-03-01T00:00:00Z",
        "expectedAttendees": 1,
        "status": "pending | approved | rejected | cancelled",
        "reason": "reason" or null,
        "createdAt": "2022-01-01T00:00:00Z",
        "updatedAt": "2022-01-01T00:00:00Z"
      },
      // ... more events
    ]
  }
}
```

### [AUTH] GET `/api/events/{filter}`

Get all specific events only. {status} could be "pending", "approved", "rejected", or "cancelled"

**Header**

```json
{
  "Authorization": "Bearer accessToken..."
}
```

**Response `200 OK` (All roles)**

```json
{
  "success": true,
  "backendMessage": "Events fetched.",
  "data": {
    "events": [
      {
        "eventId": 1,
        "organizerId": 1,
        "title": "Introduction to C#",
        "description": "Learn the basics of C# programming.",
        "startDateTime": "2026-01-01T00:00:00Z",
        "endDateTime": "2026-01-01T00:00:00Z",
        "expectedAttendees": 1,
        "status": "pending | approved | rejected | cancelled",
        "reason": "reason" or null,
        "createdAt": "2022-01-01T00:00:00Z",
        "updatedAt": "2022-01-01T00:00:00Z"
      },
      // ... more events
    ]
  }
}
```

---

### [AUTH] POST `/api/events`

- Create new event (only by student)

**Header**

```json
{
  "Authorization": "Bearer accessToken..."
}
```

**Request Body**

```json
{
  "title": "Event Title",
  "description": "Event Description",
  "startDateTime": "2026-01-01T00:00:00Z",
  "endDateTime": "2026-01-01T00:00:00Z",
  "expectedAttendees": 100,
  "submitLetter": pdf file,
  "venueId": 1
}
```

**Response `200 OK` (Student)**

```json
{
  "success": true,
  "backendMessage": "Event created successfully.",
  "data": {
    "eventId": 1,
    "title": "Event Title",
    "description": "Event Description",
    "startDateTime": "2026-01-01T00:00:00Z",
    "endDateTime": "2026-01-01T00:00:00Z",
    "expectedAttendees": 100,
    "venueId": 1
  }
}
```

---

### [AUTH] DELETE `/api/events/{eventId}`

-Delete event (only by student)

**Header**

```json
{
  "Authorization": "Bearer accessToken..."
}
```

**Request Body**

```json
{
  "reason": null or "reason"
}
```

**Response `200 OK` (Student)**

```json
{
  "success": true,
  "backendMessage": "Event deleted successfully.",
  "data": {
    "eventId": 1,
    "title": "Event Title",
    "description": "Event Description",
    "startDateTime": "2026-01-01T00:00:00Z",
    "endDateTime": "2026-01-01T00:00:00Z",
    "expectedAttendees": 100,
    "venueId": 1
  }
}
```

---

### [AUTH] PATCH `/api/events/{eventId}/status`

-Update event status (only by faculty)
-Cancel event (only by student)

**Header**

```json
{
  "Authorization": "Bearer accessToken..."
}
```

**Request Body**

```json
{
  "status": "approved | rejected | cancelled",
  "reason": "reason" or null
}
```

**Response `200 OK` (Faculty)**

```json
{
  "success": true,
  "backendMessage": "Event status updated successfully.",
  "data": {
    "eventId": 1,
    "title": "Event Title",
    "description": "Event Description",
    "startDateTime": "2026-01-01T00:00:00Z",
    "endDateTime": "2026-01-01T00:00:00Z",
    "expectedAttendees": 100,
    "status": "approved | rejected",
    "reason": "reason" or null
  }
}
```

**Response `200 OK` (Student)**

```json
{
  "success": true,
  "backendMessage": "Event is cancelled.",
  "data": {
    "eventId": 1,
    "title": "Event Title",
    "description": "Event Description",
    "startDateTime": "2026-01-01T00:00:00Z",
    "endDateTime": "2026-01-01T00:00:00Z",
    "expectedAttendees": 100,
    "status": "cancelled",
    "reason": "reason" or null
  }
}
```

---

## 3) Venue Reservation

> **Faculty** manages venues (add, edit, delete).  
> **Students** reserve venues through the event creation flow — not a separate endpoint.

---

### [AUTH] GET `/api/venue`

- Get all venues (available or not)

**Header**

```json
{
  "Authorization": "Bearer accessToken..."
}
```

**Response `200 OK` (Faculty or Student)**

```json
{
  "success": true,
  "backendMessage": "Venues fetched successfully.",
  "data": {
    "venues": [
      {
        "venueId": 1,
        "name": "West Auditorium",
        "location": "Ground Floor, West Wing",
        "capacity": 200
      },
      {
        "venueId": 2,
        "name": "East Auditorium",
        "location": "Ground Floor, East Wing",
        "capacity": 200
      }
    ]
  }
}
```

---

### [AUTH] GET `/api/venue/{venueId}`

-Get specific venue's details.

**Header**

```json
{
  "Authorization": "Bearer accessToken..."
}
```

**Response `200 OK` (Faculty or Student)**

```json
{
  "success": true,
  "backendMessage": "Venues fetched successfully.",
  "data": {
    "venues": [
      {
        "venueId": 1,
        "name": "West Auditorium",
        "location": "Ground Floor, West Wing",
        "capacity": 200
      },
      {
        "venueId": 2,
        "name": "East Auditorium",
        "location": "Ground Floor, East Wing",
        "capacity": 200
      }
    ]
  }
}
```

---

### [AUTH] POST `/api/venues/addvenue`

- Add new venue (only by faculty)

**Header**

```json
{
  "Authorization": "Bearer accessToken..."
}
```

**Request Body**

```json
{
  "name": "West Auditorium",
  "location": "Ground Floor, West Wing",
  "capacity": 200
}
```

**Response `200 OK` (Faculty)**

```json
{
  "success": true,
  "backendMessage": "Venue added successfully.",
  "data": {
    "venueId": 1,
    "name": "West Auditorium",
    "location": "Ground Floor, West Wing",
    "capacity": 200
  }
}
```

---

## 4) Notification System

> Notifications are auto-generated by the backend (via BackgroundService).  
> Users can only **read** and **manage** their own notifications.  
> No role creates notifications manually — the system does it.

---

### [AUTH] GET `/api/notification`

Get all notifications for the currently logged-in user.  
Ordered by newest first.

**Header**

```json
{
  "Authorization": "Bearer accessToken..."
}
```

**Response `200 OK` (All roles)**

```json
{
  "success": true,
  "backendMessage": "Notifications fetched.",
  "data": {
    "unreadCount": 2,
    "notifications": [
      {
        "notificationId": 1,
        "message": "Your event 'Bug Hunting' is happening tomorrow.",
        "isRead": false,
        "eventId": 1,
        "createdAt": "2026-07-09T09:00:00Z"
      },
      {
        "notificationId": 2,
        "message": "Your event 'IT Week' has been approved.",
        "isRead": true,
        "eventId": 2,
        "createdAt": "2026-07-08T14:00:00Z"
      }
      // More notifications...
    ]
  }
}
```

---

### [AUTH] PATCH `/api/notifications/{notificationId}/read`

Mark a single notification as read.

**Header**

```json
{
  "Authorization": "Bearer accessToken..."
}
```

**Response `200 OK` (All roles)**

```json
{
  "success": true,
  "backendMessage": "Notification marked as read.",
  "data": {
    "notificationId": 1,
    "isRead": true
  }
}
```

---

### [AUTH] PATCH `/api/notification/read-all`

Mark all of the logged-in user's notifications as read at once.

**Header**

```json
{
  "Authorization": "Bearer accessToken..."
}
```

**Response `200 OK` (All roles)**

```json
{
  "success": true,
  "backendMessage": "All notifications marked as read."
}
```

---

### [AUTH] GET `/api/notification/preference`

Get the logged-in user's current notification preferences.

**Header**

```json
{
  "Authorization": "Bearer accessToken..."
}
```

**Response `200 OK` (All roles)**

```json
{
  "success": true,
  "backendMessage": "Preferences fetched.",
  "data": {
    "notifyOneDayBefore": true,
    "notifyOneWeekBefore": false,
    "notifyOnStatusChange": true
  }
}
```

---

### [AUTH] PUT `/api/notification/preference`

Update the logged-in user's notification preferences.

**Header**

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer accessToken..."
}
```

**Request Body (All roles)**

```json
{
  "notifyOneDayBefore": true,
  "notifyOneWeekBefore": true,
  "notifyOnStatusChange": true
}
```

**Response `200 OK` (All roles)**

```json
{
  "success": true,
  "backendMessage": "Preferences updated."
}
```

---

## 5) Dashboard Overview

### [AUTH] GET `/api/dashboard/me`

Get the current user's dashboard summary.  
Response shape varies by role.

**Header**

```json
{
  "Authorization": "Bearer accessToken..."
}
```

**Response `200 OK` (All roles)**

```json
{
  "success": true,
  "backendMessage": "Dashboard loaded.",
  "data": {
    // TODO
  }
}
```

---
