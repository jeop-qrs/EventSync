
using System.Security.Claims;
using backend.DTO;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class NotificationController : ControllerBase
    {
        private readonly NotificationService _notificationService;
        public NotificationController(NotificationService notificationService) // Constructor
        {
            _notificationService = notificationService;
        }

        [Authorize]
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            // Get user ID from JWT token
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null)
            {
                return Unauthorized(new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "User not authenticated.",
                    Data = null
                });
            }
            var userId = int.Parse(userIdClaim.Value);
            var result = await _notificationService.GetAll(userId);
            return Ok(result);
        }

        [Authorize]
        [HttpPost("{notificationId}/read")]
        public async Task<IActionResult> MarkAsRead([FromRoute] int notificationId)
        {
            var result = await _notificationService.MarkAsRead(notificationId);
            return Ok(result);
        }

        [Authorize]
        [HttpPost("mark-all-read")]
        public async Task<IActionResult> MarkAllAsRead()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null)
            {
                return Unauthorized(new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "User not authenticated.",
                    Data = null
                });
            }
            var userId = int.Parse(userIdClaim.Value);
            var result = await _notificationService.MarkAllAsRead(userId);
            return Ok(result);
        }

        [Authorize]
        [HttpGet("preferences")]
        public async Task<IActionResult> GetPreference()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null)
            {
                return Unauthorized(new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "User not authenticated.",
                    Data = null
                });
            }
            var userId = int.Parse(userIdClaim.Value);
            var result = await _notificationService.GetPreference(userId);
            return Ok(result);
        }

        [Authorize]
        [HttpPut("preferences")]
        public async Task<IActionResult> UpdatePreferences(NotificationUpdatePreferenceDto preference)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null)
            {
                return Unauthorized(new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "User not authenticated.",
                    Data = null
                });
            }
            var userId = int.Parse(userIdClaim.Value);
            var result = await _notificationService.UpdatePreference(userId, preference);
            return Ok(result);
        }
    }
}