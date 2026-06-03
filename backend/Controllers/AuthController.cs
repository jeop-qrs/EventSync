// ------------------------------------------------------------
// File: AuthController.cs
// Purpose: Handles user registration and login requests
// ------------------------------------------------------------

using Microsoft.AspNetCore.Mvc;

using backend.DTO.Auth;
using backend.Services.App;


namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        // api/auth/register
        [HttpPost("register")]
        public async Task<ActionResult> Register(RegisterReq req)
        {
            var result = await _authService.Register(req);
            if (result.Success == false)
            {
                return BadRequest(new RegisterRes{ Success = result.Success, Message = result.Message });
            }
            return Ok(new RegisterRes{ Success = result.Success, Message = result.Message });
        }

        // api/auth/login
        [HttpPost("login")]
        public async Task<ActionResult> Login(LoginReq req)
        {
            var result = await _authService.Login(req);
            if (result.Success == false)
            {
                return BadRequest(new LoginRes{ Success = result.Success, Message = result.Message });
            }
            return Ok(new LoginRes{ Success = result.Success, Message = result.Message });
        }
    }
}