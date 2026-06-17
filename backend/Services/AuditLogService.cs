using System;
using System.Security.Claims;
using System.Threading.Tasks;
using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Http;

namespace backend.Services
{
    public class AuditLogService
    {
        private readonly AppDbContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public AuditLogService(AppDbContext context, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task LogAsync(
            int? userId,
            string? userIdentifier,
            string? userFullName,
            string? role,
            string objectType,
            string action,
            string objectName)
        {
            var httpContext = _httpContextAccessor.HttpContext;
            string ipAddress = "127.0.0.1";
            string url = string.Empty;

            if (httpContext != null)
            {
                ipAddress = httpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
                url = httpContext.Request.Path.Value ?? string.Empty;

                if (httpContext.User?.Identity?.IsAuthenticated == true)
                {
                    // Auto-populate userId from JWT claims if not explicitly provided
                    if (userId == null)
                    {
                        var idClaim = httpContext.User.FindFirst(ClaimTypes.NameIdentifier);
                        if (idClaim != null && int.TryParse(idClaim.Value, out int parsedId))
                        {
                            userId = parsedId;
                        }
                    }

                    // Auto-populate FullName from JWT claims if not explicitly provided
                    if (string.IsNullOrEmpty(userFullName))
                    {
                        var nameClaim = httpContext.User.FindFirst(ClaimTypes.Name);
                        if (nameClaim != null && !string.IsNullOrEmpty(nameClaim.Value))
                        {
                            userFullName = nameClaim.Value;
                        }
                    }

                    // Auto-populate Role from JWT claims if not explicitly provided
                    if (string.IsNullOrEmpty(role))
                    {
                        var roleClaim = httpContext.User.FindFirst(ClaimTypes.Role);
                        if (roleClaim != null && !string.IsNullOrEmpty(roleClaim.Value))
                        {
                            role = roleClaim.Value;
                        }
                    }
                }
            }

            // Fetch missing user details from the database if userId is available
            if (userId != null && (string.IsNullOrEmpty(userIdentifier) || string.IsNullOrEmpty(userFullName) || string.IsNullOrEmpty(role)))
            {
                var dbUser = await _context.Users.FindAsync(userId.Value);
                if (dbUser != null)
                {
                    if (string.IsNullOrEmpty(userIdentifier))
                        userIdentifier = dbUser.Role == "faculty" ? dbUser.Username : dbUser.StudentNumber;
                    if (string.IsNullOrEmpty(userFullName))
                        userFullName = dbUser.FullName;
                    if (string.IsNullOrEmpty(role))
                        role = dbUser.Role;
                }
            }

            var logEntry = new AuditLog
            {
                Timestamp = DateTime.UtcNow,
                UserId = userId,
                UserIdentifier = userIdentifier ?? "Anonymous",
                UserFullName = userFullName ?? "Anonymous",
                Role = role ?? "Anonymous",
                IpAddress = ipAddress,
                ObjectType = objectType,
                Action = action,
                ObjectName = objectName,
                Url = url
            };

            _context.AuditLogs.Add(logEntry);
            await _context.SaveChangesAsync();
        }
    }
}
