# API Contract - EventSync

**Version:** 1.1.0  
**Base URL:** `http://localhost:5108` (TBD)

---

## Common HTTP Status Codes

| Status | Meaning                                   | Method                             |
| ------ | ----------------------------------------- | ---------------------------------- |
| `200`  | Success + Payload (optional)              | `return Ok(optionalmessage);`      |
| `400`  | Bad Request — validation failed           | `return BadRequest(error);`        |
| `401`  | Unauthorized — not authenticated          | `return Unauthorized();`           |
| `403`  | Forbidden — authenticated but not allowed | `return Forbid();`                 |
| `404`  | Not Found — resource doesn't exist        | `return NotFound();`               |
| `500`  | Server Error — something broke on our end | `return StatusCode(500, message);` |

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

Register a new user.

**Header**

```json
{
  "Content-Type": "application/json"
}
```

**Request Body (Student)**

```json
{
  "studentNumber": "2024-2025",
  "password": "password123",
  "role": "student"
}
```

**Request Body (Faculty)**

```json
{
  "username": "juandelacruz",
  "password": "password123",
  "role": "faculty"
}
```

**Response `200 OK` (All roles)**

```json
{
  "success": true,
  "backendMessage": "Register successful. Log in again."
}
```

---

### [PUB] POST `/api/auth/login`

Authenticate a user as a student and return JWT tokens.

**Header**

```json
{
  "Content-Type": "application/json"
}
```

**Request Body (Student)**

```json
{
  "studentNumber": "2024-2025",
  "password": "password123"
}
```

**Request Body (Faculty)**

```json
{
  "username": "juandelacruz",
  "password": "password123"
}
```

**Response `200 OK` (Student)**

```json
{
  "success": true,
  "backendMessage": "Login successful.",
  "data": {
    "studentNumber": "01234abc2026-B",
    "role": "student",
    "accessToken": "accessToken...",
    "expiresAt": 3599,
    "refreshToken": "refreshToken..."
  }
}
```

**Response `200 OK` (Faculty)**

```json
{
  "success": true,
  "backendMessage": "Login successful.",
  "data": {
    "username": "juandelacruz",
    "role": "faculty",
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

### [AUTH] GET `/api/events?status={status}`

Get events based on role and query status.
For student, returns owned events (pending, approved, rejected, cancelled).  
For faculty, returns reviewed events (approved and rejected) and all pending events.

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
        "facultyId": 1 or null, // null if no faculty has reviewed the event
        "venueId": 1,
        "title": "Introduction to C#",
        "department": "COMMITS",
        "eventDate": "2026-01-01T00:00:00Z",
        "startTime": "13:00",
        "expectedAttendees": 100,
        "submitLetterPath": "uploads/events/permission-letters/abc123.pdf",
        "status": "pending | approved | rejected | cancelled",
        "reason": "Reason" or null,
        "createdAt": "2026-05-12T12:00:00Z",
        "updatedAt": "2026-05-17T15:00:00Z"
      },
      // ... more events
    ]
  }
}
```

---

### [AUTH] POST `/api/events`

Create a new event request. Submitted by student only.  
Uses `multipart/form-data`.

**Header**

```json
{
  "Authorization": "Bearer accessToken..."
}
```

**Request Body (multipart/form-data)**

| Field             | Type                  | Required | Description                  |
| ----------------- | --------------------- | -------- | ---------------------------- |
| title             | string                | ✅       | Event title                  |
| department        | string                | ✅       | e.g. COMMITS                 |
| venueId           | int                   | ✅       | Selected venue               |
| eventDate         | datetime (YYYY-MM-DD) | ✅       | Event date                   |
| startTime         | timeonly (HH:mm)      | ✅       | Start time                   |
| expectedAttendees | int                   | ✅       | Must be > 0                  |
| submitLetter      | file (PDF/JPG/PNG)    | ✅       | Permission letter (max 10MB) |

**Response `200 OK` (Student)**

```json
{
  "success": true,
  "backendMessage": "Event request created successfully.",
  "data": {
    "eventId": 1,
    "organizerId": 1,
    "facultyId": null, // Always null when created, therefore omitted
    "venueId": 1,
    "title": "Event Title",
    "department": "COMMITS",
    "eventDate": "2026-11-05",
    "startTime": "13:00",
    "expectedAttendees": 100,
    "submitLetterPath": "uploads/events/permission-letters/abc123.pdf",
    "status": "pending",
    "reason": null, // Always null when created, therefore omitted
    "createdAt": "2026-05-12T12:00:00Z",
    "updatedAt": null // Always null when created, therefore omitted
  }
}
```

---

### [AUTH] PATCH `/api/events/{eventId}/status`

Update event status to approved or rejected (only by faculty).  
Cancel event (only by student).

**Header**

```json
{
  "Authorization": "Bearer accessToken..."
}
```

**Request Body (Faculty)**

```json
{
  "status": "approved | rejected",
  "reason": "Reason" or null
}
```

**Request Body (Student)**

```json
{
  "status": "cancelled",
  "reason": "Reason" or null
}
```

**Response `200 OK` (All roles)**

```json
{
  "success": true,
  "backendMessage": "Event status updated successfully.",
  "data": {
    "eventId": 1,
    "organizerId": 1,
    "facultyId": 1 or null, // null if faculty has not reviewed the event yet, or if event is cancelled by student
    "venueId": 1,
    "title": "Introduction to C#",
    "department": "COMMITS",
    "eventDate": "2026-11-05",
    "startTime": "13:00",
    "expectedAttendees": 100,
    "submitLetterPath": "uploads/events/permission-letters/abc123.pdf",
    "status": "approved | rejected | cancelled",
    "reason": "Reason" or null,
    "createdAt": "2026-05-12T12:00:00Z",
    "updatedAt": "2026-05-17T15:00:00Z"
  }
}
```

---

## 3) Venue Reservation

> **Faculty** manages venues (add, edit, delete).  
> **Students** reserve venues through the event creation flow.

---

### [AUTH] GET `/api/venues` or `/api/venues?status={status}`

Get venues filtered by status (available or unavailable).  
If no status is provided, all venues are returned.

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
        "address": "Ground Floor, West Wing",
        "capacity": 200,
        "description": "description",
        "availability": "Mon - Fri | 8:00 AM - 5:00 PM",
        "timeslots": [
          {
            "startTime": "08:00",
            "endTime": "11:00"
          },
          {
            "startTime": "13:00",
            "endTime": "15:00"
          },
          {
            "startTime": "16:00",
            "endTime": "19:00"
          }
        ],
        "status": "available | unavailable",
        "photoPath": "uploads/venues/venue-1.jpg"
      }
      // more venues
    ]
  }
}
```

---

### [AUTH] POST `/api/venues`

Add new venue (only by faculty).  
Uses `multipart/form-data`.  
Timeslot format: `HH:mm`.

**Header**

```json
{
  "Authorization": "Bearer accessToken..."
}
```

**Request Body**

```
multipart/form-data

- name: "Bamboo Hall"
- address: "Main Campus"
- capacity: 200
- description: "description"
- availability: "Mon - Fri | 8:00 AM - 5:00 PM"
- timeslots: "8:00 - 11:00"
- timeslots: "13:00 - 15:00"
- timeslots: "16:00 - 17:00"
- photoCover: file (jpeg, png, jpg)
```

**Response `200 OK` (Faculty)**

```json
{
  "success": true,
  "backendMessage": "Venue added successfully.",
  "data": {
    "venueId": 1,
    "name": "West Auditorium",
    "address": "Ground Floor, West Wing",
    "capacity": 200,
    "description": "description",
    "availability": "Mon - Fri | 8:00 AM - 5:00 PM",
    "timeslots": [
      {
        "startTime": "08:00",
        "endTime": "11:00"
      },
      {
        "startTime": "13:00",
        "endTime": "15:00"
      },
      {
        "startTime": "16:00",
        "endTime": "17:00"
      }
    ],
    "status": "available",
    "photoPath": "uploads/venues/venue-1.jpg"
  }
}
```

---

## 4) Notification System

> Notifications are auto-generated by the backend (via BackgroundService).  
> Users can only **read** and **manage** their own notifications.  
> No role creates notifications manually — the system does it.

---

### [AUTH] GET `/api/notifications`

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
        "createdAt": "2026-05-12T09:00:00Z"
      },
      {
        "notificationId": 2,
        "message": "Your event 'IT Week' has been approved.",
        "isRead": true,
        "eventId": 2,
        "createdAt": "2026-05-17T15:00:00Z"
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

### [AUTH] PATCH `/api/notifications/read-all`

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

### [AUTH] GET `/api/notifications/preferences`

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

### [AUTH] PUT `/api/notifications/preferences`

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

**Response `200 OK` (Student)**

```json
{
  "success": true,
  "backendMessage": "Dashboard loaded.",
  "data": {
    "proposedEvents": 14, // total count of events proposed by the student
    "pendingApproval": 2, // pending events that need faculty approval
    "availableVenues": 3, // available venues for today
    "mySubmittedEvents": [
      // display all events created by the student (approved, rejected, pending, or cancelled)
    ]
  }
}
```

**Response `200 OK` (Faculty)**

```json
{
  "success": true,
  "backendMessage": "Dashboard loaded.",
  "data": {
    "totalActiveEvents": 1,
    "pendingApproval": 2,
    "availableVenuesToday": 1,
    "rejected": 0,
    "trackedEvents": [
      // shows events submitted by students (approved, rejected, pending)
      {
        "eventId": 1,
        "title": "Event Title",
        "description": "Event Description",
        "startDateTime": "2026-01-01T00:00:00Z",
        "endDateTime": "2026-01-01T00:00:00Z",
        "expectedAttendees": 100,
        "status": "proposed"
      }
      // more...
    ]
  }
}
```

---
