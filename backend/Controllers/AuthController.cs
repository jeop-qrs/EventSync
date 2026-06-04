// ------------------------------------------------------------
// File: AuthController.cs
// Purpose: Handles user registration and login requests
// ------------------------------------------------------------

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

using backend.DTO;
using backend.Services;


namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AuthService _authService;
        public AuthController(AuthService authService)
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
        public async Task<IActionResult> Refresh(RefreshRequest req)
        {
            var result = await _authService.Refresh(req);
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }

        // api/auth/logout
        [Authorize]
        [HttpPost("logout")]
        public async Task<ActionResult> Logout()
        {
            var result = await _authService.Logout();
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }
    }
}
