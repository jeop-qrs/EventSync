# API Contract - EventSync

> **Version:** 1.0.0
> **Base URL:** `http://localhost:5108` (TBD)

---

## Common HTTP Status Codes

| Status | Meaning | Method |
|--------|---------|--------|
| `200` | Success + Payload (optional) | `return Ok(optionalmessage);` |
| `201` | Resource created | `return Created("", );` |
| `204` | Success + No message | `return NoContent();` |
| `400` | Bad Request — validation failed | `return BadRequest(error);` |
| `401` | Unauthorized — not authenticated | `return Unauthorized();` |
| `403` | Forbidden — authenticated but not allowed | `return Forbid();` |
| `404` | Not Found — resource doesn't exist | `return NotFound();` |
| `500` | Server Error — something broke on our end | `return StatusCode(500, message);` |

---

## Legend

| Symbol | Meaning |
|--------|---------|
| 🟩 | Public — no login/auth required |
| 🟨 | Protected — login needed/requires valid JWT |
| 🟥 | Admin only |

---

## Table of Contents

1. [Auth](#auth)
2. [Service](#service)

---

## Auth

### 🟩 POST `/api/auth/register`

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
  "user": "juandelacruz",
  "password": "password123",
  "role": "student" or "faculty"
}
```

**Response `200 OK`**
```json
{
  "success": true,
  "backendMessage": "Register successful. Log in again"
}
```

---

### 🟩 POST `/api/auth/login`

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
  "user": "juandelacruz",
  "password": "password123"
}
```

**Response `200 OK`**
```json
{
  "success": true,
  "backendMessage": "Login Successful",
  {
    "studNo": "01234abc2026-B",
    "role": "student",
    "accessToken": "ehJwign...",
    "expiresAt": "2000", (secs)
    "refreshToken": "shWUbds..."
  }
}
```

---

### 🟨 POST `/api/auth/refresh`

Rotate the accessToken and refreshToken (generate new tokens).
Must be automatic if accessToken expired.

**Header**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer ehJwign..."
}
```

**Request Body**
```json
{
  "user": "juandelacruz",
  "refreshToken": "shWUbds..."
}
```

**Response `200 OK`**
```json
{
  "success": true,
  "backendMessage": "Token refreshed",
  {
    "studNo": "01234abc2026-B",
    "role": "student",
    "accessToken": "ehJwign...",
    "expiresAt": "2026-07-03T9:34:52Z",
    "refreshToken": "shWUbds..."
  }
}
```

---

### 🟨 POST `/api/auth/logout`

Invalidate the current session and stored refresh token.

**Header**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer ehJwign..."
}
```

**Request Body**
```json
No body
```

**Response `200 OK`**
```json
{
  "success": true,
  "backendMessage": "Logout Successful",
}
```

---

### 🟩 POST `/api/auth/forgot-password` (Inactive)

Send a password reset link to the user's email.

---

### 🟩 POST `/api/auth/reset-password` (Inactive)

Reset password using token from the email link.

---

### 🟩 POST `/api/auth/verify-email` (Inactive)

Verify user's email address using the token sent on registration.

---

## Service