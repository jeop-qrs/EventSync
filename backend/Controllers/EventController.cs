// ------------------------------------------------------------
// File: EventController.cs
// Purpose: Handles CRUD operations for events
// ------------------------------------------------------------

using System.Security.Claims; // Required to read the logged-in user's ID/Role
using backend.DTO;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]s")]
    public class EventController : ControllerBase
    {
        private readonly EventService _eventService;

        public EventController(EventService eventService)
        {
            _eventService = eventService;
        }

        [HttpGet]
        [Authorize]
        public async Task<ActionResult> GetEvents([FromQuery] string status)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
            var userRole = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
            if (userRole == "student" || userRole == "faculty")
            {
                var result = await _eventService.GetEvents(userId, userRole, status);
                if (!result.Success) return BadRequest(result);
                return Ok(result);
            }
            return Unauthorized(new GlobalResponse { Success = false, BackendMessage = "Invalid role" });
        }

        [HttpPost]
        [Authorize(Roles = "Student")]
        public async Task<ActionResult> Create([FromForm] EventCreateRequest req)
        {
            int studentId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
            if (studentId == 0) return Unauthorized(new GlobalResponse { Success = false, BackendMessage = "Invalid user" });
            var result = await _eventService.CreateEvent(req, studentId);
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }

        [HttpPatch("{id}/status")]
        [Authorize]
        public async Task<ActionResult> UpdateStatus([FromRoute] int eventId, [FromBody] EventStatusUpdateRequest req)
        {
            int userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
            string userRole = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
            var result = await _eventService.UpdateEventStatus(eventId, userId, userRole, req);
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }
    }
}