using backend.Data;
using backend.DTO;
using backend.Models;
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

        public async Task<GlobalResponse> Get(int userId, string userRole)
        {
            if (userRole == "Student")
            {
                int countProposedEvents = await _context.Events
                    .Where(e => e.OrganizerId == userId)
                    .CountAsync();
                int countPendingApproval = await _context.Events
                    .Where(e => e.OrganizerId == userId && e.Status.Equals("pending", StringComparison.OrdinalIgnoreCase))
                    .CountAsync();
                int countAvailableVenues = await _context.Venues
                    .Where(v => v.Status.Equals("available", StringComparison.OrdinalIgnoreCase))
                    .CountAsync();
                int countCancelledEvents = await _context.Events
                    .Where(e => e.OrganizerId == userId && e.Status.Equals("cancelled", StringComparison.OrdinalIgnoreCase))
                    .CountAsync();
                List<Event> mySubmittedEvents = await _context.Events
                    .Where(e => e.OrganizerId == userId)
                    .ToListAsync();

                var dashboard = new DashboardStudentResponseDto
                {
                    ProposedEvents = countProposedEvents,
                    PendingApproval = countPendingApproval,
                    AvailableVenues = countAvailableVenues,
                    CancelledEvents = countCancelledEvents,
                    MySubmittedEvents = mySubmittedEvents
                };

                return new GlobalResponse
                {
                    Success = true,
                    BackendMessage = "Dashboard retrieved successfully",
                    Data = dashboard
                };
            }
            else if (userRole == "Faculty")
            {
                int countTotalActiveEvents = await _context.Events
                    .Where(e => e.FacultyId == userId && e.Status.Equals("approved", StringComparison.OrdinalIgnoreCase))
                    .CountAsync();
                int countPendingApproval = await _context.Events
                    .Where(e => e.Status.Equals("pending", StringComparison.OrdinalIgnoreCase))
                    .CountAsync();
                int countAvailableVenuesToday = await _context.Venues
                    .Where(v => v.Status.Equals("available", StringComparison.OrdinalIgnoreCase))
                    .CountAsync();
                int countRejectedEvents = await _context.Events
                    .Where(e => e.FacultyId == userId && e.Status.Equals("rejected", StringComparison.OrdinalIgnoreCase))
                    .CountAsync();
                List<Event> trackedEvents = await _context.Events
                    .Where(e => e.Status.Equals("ongoing", StringComparison.OrdinalIgnoreCase) || (e.FacultyId == userId && (e.Status.Equals("approved", StringComparison.OrdinalIgnoreCase) || e.Status.Equals("rejected", StringComparison.OrdinalIgnoreCase))))
                    .ToListAsync();

                var dashboard = new DashboardFacultyResponseDto
                {
                    TotalActiveEvents = countTotalActiveEvents,
                    PendingApproval = countPendingApproval,
                    AvailableVenuesToday = countAvailableVenuesToday,
                    RejectedEvents = countRejectedEvents,
                    TrackedEvents = trackedEvents,
                };

                return new GlobalResponse
                {
                    Success = true,
                    BackendMessage = "Dashboard retrieved successfully",
                    Data = dashboard
                };
            }
            else
            {
                return new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "Invalid user role",
                    Data = null
                };
            }
        }
    }
}