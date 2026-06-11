// ------------------------------------------------------------
// File: EventController.cs
// Purpose: Handles CRUD operations for events
// ------------------------------------------------------------

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims; // Required to read the logged-in user's ID/Role

using backend.DTO;
using backend.Services;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")] // Routes to /api/event (consider changing to "events" per your spec!)
    public class EventController : ControllerBase
    {
        private readonly EventService _eventService;

        public EventController(EventService eventService)
        {
            _eventService = eventService;
        }

        // GET: api/event
        [Authorize]
        [HttpGet]
        public async Task<ActionResult> GetAll()
        {
            var result = await _eventService.GetAllEvents();
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }

        // GET: api/event/filter?filter=pending
        [Authorize]
        [HttpGet("filter")]
        public async Task<ActionResult> GetByFilter([FromQuery] string filter) 
        {
            var result = await _eventService.GetEventsByFilter(filter);
            if (!result.Success) return NotFound(result);
            return Ok(result);
        }

        // POST: api/event
        [Authorize(Roles = "Student")] // Optional but recommended: lock this at the routing level
        [HttpPost]
        public async Task<ActionResult> Create([FromForm] EventCreateRequest req) // Added [FromForm] for PDF
        {
            // Extract the user ID from the JWT Token
            int studentId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

            var result = await _eventService.CreateEvent(req, studentId);
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }

        // PATCH: api/event/{id}/status
        [Authorize]
        [HttpPatch("{id}/status")] // Changed from PUT to PATCH to match your spec
        public async Task<ActionResult> UpdateStatus(int id, [FromBody] EventStatusUpdateRequest req)
        {
            int userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
            string userRole = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

            var result = await _eventService.UpdateEventStatus(id, req, userId, userRole);
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }

        // DELETE: api/event/{id}
        [Authorize(Roles = "Student")]
        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            int studentId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

            var result = await _eventService.DeleteEvent(id, studentId);
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }
    }
}