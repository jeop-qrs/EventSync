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

**Request Body**
```json
{
  "studno": "01234abc2026-B",
  "password": "pass",
  "role": "student" or "faculty"
}
```

**Response `201 Created`**
```json
{
  "success": true,
  "message": "Registration successful."
}
```

---

### 🟩 POST `/api/auth/login`

Authenticate a user and return JWT tokens.

**Request Body**
```json
{
  "studno": "01234abc2026-B",
  "password": "SuperSecret123!"
}
```

**Response `200 OK`**
```json
{
  "success": true,
  "message": "Login Successful",

  "token": "ehJIwqh..",
  "expiresAt": "2026-05-04T12:00:00Z"
}
```

---

### 🟩 POST `/api/auth/logout` (Inactive)

Invalidate the current session/token.

---

## Auth (Coming soon)

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