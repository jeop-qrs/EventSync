# EventSync

A web-based event scheduling and venue reservation system designed for academic institutions.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Features](#2-features)
3. [Technology Stack](#3-technology-stack)
4. [System Architecture](#4-system-architecture)
5. [Project Structure](#5-project-structure)
6. [API Documentation Reference](#6-api-documentation-reference)
7. [System Design Reference](#7-system-design-reference)
8. [Installation & Setup](#8-installation--setup)
9. [Environment Variables](#9-environment-variables)
10. [Usage](#10-usage)
11. [Testing](#11-testing)
12. [Contributors](#12-contributors)
13. [Acknowledgements](#13-acknowledgements)
14. [License](#14-license)

---

## 1. Project Overview

**EventSync** is a full-stack event scheduling and venue reservation system tailored for an academic institution environment. It provides a structured workflow for student organizations to propose events, reserve venues, and receive approval from faculty coordinators — all tracked through a centralized platform.

### Purpose

Managing academic events manually is error-prone and inefficient. EventSync solves this by digitizing the entire lifecycle of an event request: from venue selection and submission of a permission letter, through faculty review and approval, to automated reminders and audit logging. It ensures that no two events are double-booked at the same venue, and that all actions are traceable.

### Problem Being Solved

- Students had no centralized system to check venue availability or submit event proposals digitally.
- Faculty had no unified view of pending event requests requiring review.
- There was no automated mechanism for reminding organizers of upcoming events.
- No audit trail existed to track who performed what action and when.

---

## 2. Features

### Authentication & Authorization

- Role-based system with two roles: **Student** and **Faculty**.
- Students register with a Student Number (exactly 10 characters); Faculty register with a username.
- Login returns a short-lived **JWT Access Token** (60 minutes) and a **Refresh Token** (7 days), both signed using HMAC-SHA256.
- Token rotation is supported via `POST /api/auth/refresh`.
- Logout invalidates the stored refresh token server-side.
- Failed login attempts (user not found, incorrect password) are logged to the audit log.

### Event Management

- **Students** submit event proposals via a multipart form, including a PDF/image permission letter.
- Events are created with a `pending` status by default.
- Conflict detection prevents two approved events from sharing the same venue, date, and start time.
- **Faculty** can approve or reject pending events; rejected events may include a reason.
- **Students** can cancel their own events (only when `pending` or `approved`).
- Event status transitions: `pending → approved`, `pending → rejected`, `pending → cancelled`, `approved → cancelled`.
- When a student cancels an approved event, the assigned faculty member is notified.

### Venue Management

- Faculty can add, update, and delete venues through the system.
- Venues include: name, address, capacity, description, availability schedule, time slots, facilities, and an optional photo banner.
- Venue time slots and facilities are stored as comma-separated strings and deserialized into lists on retrieval.
- Venue deletion is blocked if any active (non-cancelled, non-rejected) events are associated with it.
- All authenticated users (students and faculty) can view the venue directory, optionally filtered by availability status.

### Notification System

- Notifications are **system-generated only** — users cannot create them manually.
- **Status-change notifications**: When faculty approves or rejects an event, the student organizer is notified (subject to their preferences). When a student cancels an approved event, the assigned faculty is notified.
- **Scheduled reminders**: A background `ReminderService` runs every hour. It sends reminders to event organizers when their approved event is approximately 1 day away (23–25 hour window) or 1 week away (6–8 day window).
- Users can configure their notification preferences: `NotifyOneDayBefore`, `NotifyOneWeekBefore`, and `NotifyOnStatusChange`.
- Notifications can be individually or bulk-marked as read.

### Dashboard

- Role-specific summary view available at `GET /api/dashboard`.
- **Student Dashboard**: Total proposed events, events pending approval, count of available venues, cancelled events count, and a full list of submitted events.
- **Faculty Dashboard**: Total active (approved) events assigned to them, system-wide pending approval count, available venues today, rejected events count, and a list of tracked events.

### Audit Logging

- Comprehensive action log covering authentication (register, login success, login failure), event operations (create, approve, reject, cancel), venue operations (create, delete), and notification preference updates.
- Each log entry captures: timestamp (UTC), user ID, user identifier (student number or username), full name, role, IP address, object type, action type, object name, and the request URL.
- Audit logs are accessible only by **Faculty** via `GET /api/auditlogs`.
- On application startup, a data cleanup query backfills any legacy log entries that had `UserFullName = 'Anonymous'` with actual user data from the database.

---

## 3. Technology Stack

### Backend

| Component         | Technology                                                      |
|-------------------|-----------------------------------------------------------------|
| Framework         | ASP.NET Core Web API (.NET 10)                                  |
| ORM               | Entity Framework Core (EF Core) via `Microting.EntityFrameworkCore.MySql` |
| Authentication    | JWT Bearer (`Microsoft.AspNetCore.Authentication.JwtBearer`)    |
| Identity          | ASP.NET Core Identity (`Microsoft.AspNetCore.Identity.EntityFrameworkCore`) |
| Password Hashing  | `IPasswordHasher<User>` (ASP.NET Core Identity)                 |
| Token Generation  | `System.IdentityModel.Tokens.Jwt` with HMAC-SHA256              |
| Background Tasks  | `BackgroundService` (`ReminderService`) with `PeriodicTimer`    |
| File Serving      | `StaticFiles` middleware serving the `Uploads/` directory        |

### Frontend

| Component         | Technology                                           |
|-------------------|------------------------------------------------------|
| Structure         | Semantic HTML5                                       |
| Styling           | Vanilla CSS3 (`style.css`, `faculty-dash.css`, etc.) |
| Logic             | Vanilla JavaScript (ES6+) with Fetch API             |
| State             | `localStorage` / `sessionStorage`                   |

### Database

| Component     | Technology                                  |
|---------------|---------------------------------------------|
| Database      | MySQL (hosted on Aiven Cloud)               |
| Schema        | Managed via EF Core Migrations              |

### Tools / Dev Environment

| Tool              | Purpose                                          |
|-------------------|--------------------------------------------------|
| Visual Studio / VS Code | Primary IDE                              |
| .NET CLI          | Running, building, and migrating the backend     |
| EF Core CLI (`dotnet ef`) | Database migration management          |
| REST Client (`.http` files) | API testing via `.http` test files   |
| PowerShell        | Automation scripts (e.g., `verify_booking.ps1`) |
| Git               | Version control                                  |

---

## 4. System Architecture

### High-Level Architecture

EventSync follows a **decoupled client-server architecture**:

```
[ Browser (Frontend) ]  ←→  [ ASP.NET Core Web API (Backend) ]  ←→  [ MySQL (Aiven Cloud) ]
```

The frontend communicates with the backend exclusively through HTTP requests (Fetch API). The backend handles all business logic, authentication, file management, and database operations. They are served independently — the backend exposes its API, and the frontend is a static file interface.

### Backend Structure Overview

The backend is organized into the following layers:

- **Controllers** — Thin HTTP layer. Validates JWT claims, delegates to services, returns `GlobalResponse` objects.
- **Services** — Business logic layer. Handles validation, database queries (via EF Core LINQ), file I/O, and cross-service coordination (e.g., `EventService` calls `NotificationService` after a status change).
- **Models** — EF Core entity classes mapped to database tables.
- **DTOs** — Data Transfer Objects for request and response shaping.
- **Data (`AppDbContext`)** — EF Core `DbContext` with `DbSet<T>` properties for all entities.
- **Helpers** — Utility classes (e.g., `JwtGenerator` for token issuance).
- **Migrations** — EF Core auto-generated migration files tracking schema changes.

All services are registered in `Program.cs` using **Dependency Injection** (DI) with `AddScoped<T>`. CORS is configured with an open policy (`AllowAll`) for development.

### Frontend Structure Overview

The frontend consists of **static HTML pages** (`pages/`) with corresponding CSS (`assets/css/`) and JavaScript (`assets/js/`) files. Shared utilities (API base URL, token handling, shared fetch wrappers) are centralized in `shared.js`. Page-specific logic is separated into `student.js` and `faculty-dash.js`.

---

## 5. Project Structure

### Backend

```
backend/
├── Controllers/
│   ├── AuthController.cs          # POST /api/auth/* (register, login, refresh, logout)
│   ├── EventController.cs         # GET/POST/PATCH /api/events
│   ├── VenueController.cs         # GET/POST/PUT/DELETE /api/venues
│   ├── NotificationController.cs  # GET/POST/PUT /api/notifications
│   ├── DashboardController.cs     # GET /api/dashboard
│   └── AuditLogController.cs      # GET /api/auditlogs
├── Services/
│   ├── AuthService.cs             # Registration, login, refresh, logout logic
│   ├── EventService.cs            # Event CRUD, conflict detection, status transitions
│   ├── VenueService.cs            # Venue CRUD, file management
│   ├── NotificationService.cs     # Notification creation, retrieval, preference management
│   ├── ReminderService.cs         # BackgroundService: runs every 1 hour for event reminders
│   ├── DashboardService.cs        # Role-specific dashboard aggregation
│   └── AuditLogService.cs         # Action logging across all services
├── Models/
│   ├── UserModel.cs               # User entity (student / faculty)
│   ├── EventModel.cs              # Event entity with FK to User and Venue
│   ├── VenueModel.cs              # Venue entity
│   ├── NotificationModel.cs       # Notification + NotificationPreference entities
│   └── AuditLogModel.cs           # Audit log entry entity
├── DTO/
│   ├── AuthDto.cs                 # Register/Login/Refresh request & response DTOs
│   ├── EventDto.cs                # Event create & status update DTOs
│   ├── VenueDto.cs                # Venue create DTO
│   ├── NotificationDto.cs         # Notification preference update DTO
│   ├── DashboardDto.cs            # Student & faculty dashboard response DTOs
│   └── GlobalDto.cs               # GlobalResponse wrapper used by all endpoints
├── Data/
│   └── AppDbContext.cs            # EF Core DbContext with all DbSet<T> properties
├── Helpers/
│   └── JwtGenerator.cs            # Access token (JWT) and refresh token generation
├── Migrations/                    # EF Core migration files
├── Tests/
│   ├── auth.http                  # HTTP test file for auth endpoints
│   ├── event.http                 # HTTP test file for event endpoints
│   ├── venue.http                 # HTTP test file for venue endpoints
│   └── verify_booking.ps1         # PowerShell script for booking verification
├── Uploads/                       # Runtime directory for uploaded files
│   ├── Events/Letters/            # Student permission letter PDFs
│   └── Venue/Banners/             # Venue photo banners
├── Program.cs                     # Application entry point, DI registration, middleware setup
├── appsettings.json               # Base configuration
├── appsettings.Development.json   # Development-specific config (DB connection, JWT settings)
└── backend.csproj                 # Project file with NuGet dependencies
```

### Frontend

```
frontend/
├── pages/
│   ├── index.html          # Student dashboard (SPA-style: Dashboard, Venues, Event Application)
│   ├── faculty-dash.html   # Faculty dashboard (event review, venue management, audit logs)
│   ├── faculty.html        # Faculty login/register page
│   └── users.html          # Student login/register page
└── assets/
    ├── css/
    │   ├── style.css           # Student interface styles
    │   ├── faculty-dash.css    # Faculty dashboard styles
    │   ├── faculty.css         # Faculty auth page styles
    │   └── student.css         # Student auth page styles
    ├── js/
    │   ├── shared.js           # Shared utilities: token handling, API wrappers, notifications
    │   ├── student.js          # Student dashboard logic
    │   ├── faculty-dash.js     # Faculty dashboard logic
    │   └── script.js           # Auth page logic (login/register)
    └── img/
        └── EventSync logo.webp # Application logo
```

### Documentation

```
README.md
docs/
├── api-contract.md                    # Detailed API contract (all endpoints, request/response shapes)
├── system-design.md                   # System design document (architecture, data models, workflows)
├── ERD.png                            # Entity Relationship Diagram
├── UML.jpg                            # UML Architecture Diagram
└── SystemDocumentation/
    ├── EventSync-v1.docx              # System documentation v1
    └── EventSync-v2.docx              # System documentation v2
```

---

## 6. API Documentation Reference

For complete endpoint specifications, refer to [`api-contract.md`](./api-contract.md).

**API Version:** 1.1.0  
**Base URL (Development):** `http://localhost:5108`

### Authentication Requirements Summary

All endpoints — except `POST /api/auth/register` and `POST /api/auth/login` — require a valid JWT access token in the `Authorization` header:

```
Authorization: Bearer <accessToken>
```

Tokens are obtained on successful login and can be rotated via `POST /api/auth/refresh`.

### Endpoint Categories

| Category            | Base Path              | Access             |
|---------------------|------------------------|--------------------|
| Authentication      | `/api/auth`            | Public + Protected |
| Event Management    | `/api/events`          | JWT Required       |
| Venue Management    | `/api/venues`          | JWT Required       |
| Notifications       | `/api/notifications`   | JWT Required       |
| Dashboard           | `/api/dashboard`       | JWT Required       |
| Audit Logs          | `/api/auditlogs`       | Faculty Only       |

### Response Pattern

All API responses follow a consistent `GlobalResponse` wrapper:

```json
{
  "success": true,
  "backendMessage": "Description of result",
  "data": { }
}
```

When `success` is `false`, the `data` field is omitted. HTTP status codes used: `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `500 Internal Server Error`.

---

## 7. System Design Reference

For full technical documentation including architecture diagrams, data flow explanations, business rules, and EF Core service dependency diagrams, refer to [`system-design.md`](./system-design.md).

Key sections covered:
- **System Overview** — Layered architecture description
- **Architecture Diagrams (UML)** — Service dependency graph (Mermaid) and domain data model diagram
- **Authentication & Authorization System** — JWT flow, token rotation, role-based access control table
- **Core Modules** — Detailed breakdown of the Event, Venue, Notification, Dashboard, and Audit Log systems
- **API Layer Summary** — Consolidated endpoint reference with auth requirements
- **Key Service Workflows** — Mermaid sequence diagrams for event creation, faculty approval, and background reminder flows

---

## 8. Installation & Setup

### Prerequisites

| Requirement         | Version / Notes                                      |
|---------------------|------------------------------------------------------|
| .NET SDK            | .NET 10                                              |
| MySQL Server        | 8.x (or access to a hosted MySQL instance)           |
| EF Core CLI         | `dotnet tool install --global dotnet-ef`             |
| Git                 | For cloning the repository                           |
| A web browser       | For accessing the frontend                           |

---

### Backend Setup Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jeop-qrs/EventSync.git
   cd EventSync
   ```

2. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

3. **Restore NuGet packages:**
   ```bash
   dotnet restore
   ```

4. **Configure the database connection and JWT settings** (see [Environment Variables](#9-environment-variables)).

5. **Apply database migrations:**
   ```bash
   dotnet ef database update
   ```

6. **Run the backend:**
   ```bash
   dotnet run
   ```

   The API will start at `http://localhost:5108` by default.

---

### Frontend Setup Steps

The frontend is a set of static HTML/CSS/JS files and requires no build step.

1. Open the frontend pages directly from the `frontend/pages/` directory in a browser, **or** configure the backend to serve the static files.
2. Ensure the API base URL in `shared.js` points to the running backend instance (e.g., `http://localhost:5108`).

---

### Database Setup Steps

1. Ensure MySQL is running and accessible.
2. Create a database (e.g., `eventsyncdb`).
3. Update the connection string in `appsettings.Development.json` (see [Environment Variables](#9-environment-variables)).
4. Run EF Core migrations:
   ```bash
   dotnet ef database update
   ```

---

## 9. Environment Variables

Configuration is managed in `appsettings.Development.json`.

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "DefaultConnection": "Server=[DB_HOST];Port=[DB_PORT];Database=[DB_NAME];user=[DB_USER];password=[DB_PASSWORD];"
  },
  "Jwt": {
    "Key": "[JWT_SECRET_KEY]",
    "Issuer": "[JWT_ISSUER]",
    "Audience": "[JWT_AUDIENCE]",
    "ExpiryMinutes": 60
  }
}
```

| Variable                             | Description                                              |
|--------------------------------------|----------------------------------------------------------|
| `ConnectionStrings:DefaultConnection`| MySQL connection string                                  |
| `Jwt:Key`                            | Secret key used to sign JWT tokens|
| `Jwt:Issuer`                         | JWT issuer identifier         |
| `Jwt:Audience`                       | JWT audience identifier        |
| `Jwt:ExpiryMinutes`                  | Access token lifetime in minutes (default: 60)           |

---

## 10. Usage

### How to Run the Backend

```bash
cd backend
dotnet run
```

The API will be available at `http://localhost:5108`.

### How to Run the Frontend

Open the appropriate HTML file in your browser:

- **Student interface:** `frontend/pages/index.html`
- **Faculty interface:** `frontend/pages/faculty-dash.html`
- **Student login/register:** `frontend/pages/users.html`
- **Faculty login/register:** `frontend/pages/faculty.html`

> Ensure the backend is running before loading the frontend, as all data is fetched via the API.

### Basic Workflow

1. **Register** a student or faculty account via the respective login page.
2. **Log in** to receive a JWT access token (stored in local storage by the frontend).
3. **Student workflow:**
   - Browse available venues in the Venue Directory.
   - Select a venue and submit an event proposal (with PDF permission letter) via the Event Application form.
   - Monitor submitted events and their approval status on the Dashboard.
   - Cancel pending or approved events if needed.
4. **Faculty workflow:**
   - View all pending event requests on the Faculty Dashboard.
   - Approve or reject events, optionally providing a reason.
   - Add, edit, or delete venues through the Venue Management section.
   - Review the system-wide Audit Log for all recorded actions.
5. **Notifications** are automatically generated by the system on status changes and before upcoming events. Users can configure their notification preferences via the Settings modal.

---

## 11. Testing

### API Testing Tools

API endpoints are tested using **REST Client `.http` files** located in `backend/Tests/`:

| File              | Covers                                |
|-------------------|---------------------------------------|
| `auth.http`       | Register, Login, Refresh, Logout      |
| `event.http`      | Get events, Create event, Update status|
| `venue.http`      | Get venues, Add venue, Delete venue   |
| `verify_booking.ps1`| Verify booking                        |
| `notification.http`| (Coming soon)                         |
| `dashboard.http`   | (Coming soon)                         |
| `auditlogs.http`    | (Coming soon)                         |

These files can be executed using the **REST Client** extension in VS Code or any compatible HTTP client.

### Backend Testing Approach

The project uses manual HTTP-based testing via `.http` files. No automated unit or integration test suite is currently present in the codebase. API behavior is verified through direct endpoint calls against a running backend instance.

---

## 12. Contributors

## Meet The Team

**BSIT 2-2 S.Y. 2024–2025**  
Polytechnic University of the Philippines – Quezon City  
*EventSync Capstone Project Team*

---

### Contributors

| Name | GitHub | Role |
|------|---------|------|
| Erwin Airon Sia | [@N/A](https://github.com/N/A) | Business Analyst & Documenter |
| Trish Anne Adoray | [@Aitsh28](https://github.com/Aitsh28) | Frontend Developer |
| Agnes Campano | [@kddot00](https://github.com/kddot00) | Frontend Developer |
| Roe Mabli Jabaan | [@romabss](https://github.com/romabss) | Frontend Developer |
| John Mark Escorel | [@jammyie](https://github.com/jammyie) | Backend Developer |
| Daniel Micompal | [@yyxy0](https://github.com/yyxy0) | Backend Developer |
| Jeoffrey Isaiah Hernandez | [@jeop-qrs](https://github.com/jeop-qrs) | Backend Developer |

---

### Project Roles Summary

- Frontend Development – UI/UX, API Integration
- Backend Development – API, Services, Database
- Business Analyst & Documenter – Requirement Gathering, Documentation, 

---

## 13. Acknowledgements

- Polytechnic University of the Philippines – Quezon City — For providing the academic context and requirements for this system.
- The open-source communities behind ASP.NET Core, Entity Framework Core, and the .NET ecosystem.
- Inst. Ma. Michaella Alejandria — For academic guidance throughout the development of this project.

---

## 14. License

This project was developed as an **academic project** and is intended for educational and institutional use only. It is not licensed for commercial distribution. All rights are reserved by the project contributors and their respective institution.
