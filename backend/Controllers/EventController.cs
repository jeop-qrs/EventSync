// ------------------------------------------------------------
// File: EventController.cs
// Purpose: Handles CRUD operations for events
// ------------------------------------------------------------

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

using backend.DTO;
using backend.Services;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
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

        // GET: api/event/5
        [Authorize]
        [HttpGet("{id}")]
        public async Task<ActionResult> GetById(int id)
        {
            var result = await _eventService.GetEventById(id);
            if (!result.Success) return NotFound(result); 
            return Ok(result);
        }

        // POST: api/event
        [Authorize]
        [HttpPost]
        public async Task<ActionResult> Create(EventCreateRequest req)
        {
            var result = await _eventService.CreateEvent(req);
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }

        // PUT: api/event/5
        [Authorize]
        [HttpPut("{id}")]
        public async Task<ActionResult> Update(int id, EventUpdateRequest req)
        {
            var result = await _eventService.UpdateEvent(id, req);
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }

        // DELETE: api/event/5
        [Authorize]
        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            var result = await _eventService.DeleteEvent(id);
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }

        // GET: api/event/{filter}
        [Authorize]
        [HttpGet("filter")]
        public async Task<ActionResult> GetByFilter([FromQuery] string filter) 
        {
            var result = await _eventService.GetEventsByFilter(filter);
            if (!result.Success) return NotFound(result);
            return Ok(result);
        }

    }
}