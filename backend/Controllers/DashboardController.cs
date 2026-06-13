using System.Security.Claims;
using backend.DTO;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DashboardController : ControllerBase
    {
        private readonly DashboardService _dashboardService;
        public DashboardController(DashboardService dashboardService) // Constructor
        {
            _dashboardService = dashboardService;
        }

        [Authorize]
        [HttpGet]
        public async Task<IActionResult> Get()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
            var userRole = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
            if (userId == 0 && userRole == string.Empty)
            {
                return Unauthorized(new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "User not authenticated.",
                    Data = null
                });
            }
            var result = await _dashboardService.Get(userId, userRole);
            return Ok(result);
        }
    }
}