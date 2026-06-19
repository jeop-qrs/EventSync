using backend.DTO;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]s")]
    [Authorize]
    public class VenueController : ControllerBase
    {
        private readonly VenueService _venueService;

        public VenueController(VenueService venueService)
        {
            _venueService = venueService;
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetVenues([FromQuery] string? status)
        {
            var result = await _venueService.GetVenues(status);
            if (!result.Success)
            {
                return NotFound(result);
            }
            return Ok(result);
        }

        [HttpPost]
        [Authorize(Roles = "faculty")]
        public async Task<IActionResult> AddVenue([FromForm] VenueCreateDto req)
        {
            var result = await _venueService.AddVenue(req);
            if (!result.Success)
            {
                return NotFound(result);
            }
            return Ok(result);
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "faculty")]
        public async Task<IActionResult> DeleteVenue(int id)
        {
            var result = await _venueService.DeleteVenue(id);
            if (!result.Success)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }
    }
}