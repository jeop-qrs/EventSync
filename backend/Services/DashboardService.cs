using backend.Data;
using backend.DTO;
using Microsoft.EntityFrameworkCore;

namespace backend.Services
{
    public class DashboardService
    {
        private readonly AppDbContext _context;
        public DashboardService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<GlobalResponse> Get(int userId)
        {
            var events = await _context.Events
                .Where(e => e.OrganizerId == userId)
                .ToListAsync();
            return new GlobalResponse
            {
                Success = true,
                BackendMessage = "Events retrieved successfully",
                Data = events
            };
        }
    }
}