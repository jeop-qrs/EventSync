// ------------------------------------------------------------
// File: EventService.cs
// Purpose: Business logic for Event CRUD and Status updates
// ------------------------------------------------------------

using backend.Data;
using backend.DTO;
using backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Services
{
    public class EventService
    {
        private readonly AppDbContext _dbContext;
        private readonly NotificationService _notificationService;

        public EventService(AppDbContext dbContext, NotificationService notificationService)
        {
            _dbContext = dbContext;
            _notificationService = notificationService;
        }

        public async Task<GlobalResponse> GetEvents(int id, string role, string status)
        {
            List<Event> events = [];
            if (role == "student")
            {
                events = await _dbContext.Events.Where(e => e.OrganizerId == id && e.Status == status).ToListAsync();
            }
            else if (role == "faculty")
            {
                if (status == "cancelled")
                    return new GlobalResponse { Success = false, BackendMessage = "Only students can view their own cancelled events.", Data = null };
                else if (status == "pending")
                    events = await _dbContext.Events.Where(e => e.Status == "pending").ToListAsync();
                else
                    events = await _dbContext.Events.Where(e => e.FacultyId == id && e.Status == status).ToListAsync();
            }
            if (events == null)
                return new GlobalResponse { Success = false, BackendMessage = "No events found.", Data = null };
            return new GlobalResponse { Success = true, BackendMessage = "Events fetched.", Data = events };
        }

        public async Task<GlobalResponse> CreateEvent(EventCreateRequest req, int studentId)
        {
            throw new NotImplementedException();
        }

        public async Task<GlobalResponse> UpdateEventStatus(int eventId, int userId, string userRole, EventStatusUpdateRequest req)
        {
            // calls NotificationService to notify the organizer of the status change
            // await _notificationService.NotifyEventStatusChange();
            throw new NotImplementedException();
        }
    }
}