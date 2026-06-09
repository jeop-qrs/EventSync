// ------------------------------------------------------------
// File: AuthController.cs
// Purpose: Handles user registration and login requests
// ------------------------------------------------------------

using System.Security.Claims;
using backend.DTO;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;


namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AuthService _authService;
        public AuthController(AuthService authService) // Constructor
        {
            _authService = authService;
        }

        // api/auth/register
        [AllowAnonymous]
        [HttpPost("register")]
        public async Task<ActionResult> Register(AuthRegisterRequest req)
        {
            var result = await _authService.Register(req);
            if (result.Success == false) return BadRequest(result);
            return Ok(result);
        }

        // api/auth/login
        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<ActionResult> Login(AuthLoginRequest req)
        {
            var result = await _authService.Login(req);
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }

        // api/auth/refresh
        [Authorize]
        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh(AuthRefreshRequest req)
        {
            var idClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (idClaim == null) return Unauthorized("No userId found from token");
            if (!int.TryParse(idClaim.Value, out var userId))
            {
                return BadRequest(new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "Invalid userId from token"
                }
                );
            }
            var result = await _authService.Refresh(req, userId);
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }

        // api/auth/logout
        [Authorize]
        [HttpPost("logout")]
        public async Task<ActionResult> Logout()
        {
            var idClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (idClaim == null) return Unauthorized("No userId found from token");

            if (!int.TryParse(idClaim.Value, out var userId))
            {
                return Unauthorized(
                    new GlobalResponse
                    {
                        Success = false,
                        BackendMessage = "Invalid userId from token"
                    }
                );
            }

            var result = await _authService.Logout(userId);
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }
    }
}
