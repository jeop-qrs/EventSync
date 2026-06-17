using System.Security.Claims;
using System.Threading.Tasks;
using backend.Data;
using backend.DTO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/auditlogs")]
    public class AuditLogController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AuditLogController(AppDbContext context)
        {
            _context = context;
        }

        [Authorize(Roles = "faculty")]
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var logs = await _context.AuditLogs
                .OrderByDescending(l => l.Timestamp)
                .ToListAsync();

            return Ok(new GlobalResponse
            {
                Success = true,
                BackendMessage = "Audit logs retrieved successfully",
                Data = logs
            });
        }
    }
}
