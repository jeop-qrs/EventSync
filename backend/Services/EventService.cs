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
        private readonly AuditLogService _auditLogService;

        public EventService(AppDbContext dbContext, NotificationService notificationService, AuditLogService auditLogService)
        {
            _dbContext = dbContext;
            _notificationService = notificationService;
            _auditLogService = auditLogService;
        }

        public async Task<GlobalResponse> GetEvents(int id, string role, string status)
        {
            if (status == null)
                return new GlobalResponse { Success = false, BackendMessage = "Status is required for filtering events." };
            List<Event> events = [];
            if (role == "student")
            {
                events = await _dbContext.Events
                    .Include(e => e.Organizer)
                    .Where(e => e.OrganizerId == id && e.Status == status)
                    .ToListAsync();
            }
            else if (role == "faculty")
            {
                if (status == "cancelled")
                    return new GlobalResponse { Success = false, BackendMessage = "Only students can view their own cancelled events.", Data = null };
                else if (status == "pending")
                    events = await _dbContext.Events
                        .Include(e => e.Organizer)
                        .Where(e => e.Status == "pending")
                        .ToListAsync();
                else
                    events = await _dbContext.Events
                        .Include(e => e.Organizer)
                        .Where(e => e.FacultyId == id && e.Status == status)
                        .ToListAsync();
            }
            if (events.Count == 0)
                return new GlobalResponse { Success = false, BackendMessage = "No events found." };
            return new GlobalResponse { Success = true, BackendMessage = "Events fetched.", Data = events };
        }

        public async Task<GlobalResponse> CreateEvent(EventCreateRequest req, int studentId)
        {
            var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Events", "Letters");
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }
            var fileName = $"{Guid.NewGuid()}{Path.GetExtension(req.SubmitLetter.FileName)}";
            var filePath = Path.Combine(uploadsFolder, fileName);
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await req.SubmitLetter.CopyToAsync(stream);
            }
            var submitLetterPath = Path.Combine("Uploads", "Events", "Letters", fileName);
            var newEvent = new Event
            {
                OrganizerId = studentId,
                FacultyId = null,
                VenueId = req.VenueId,
                Title = req.Title,
                Department = req.Department,
                EventDate = req.EventDate,
                StartTime = req.StartTime,
                ExpectedAttendees = req.ExpectedAttendees,
                SubmitLetterPath = submitLetterPath,
                Status = "pending",
                CreatedAt = DateTime.Now
            };
            await _dbContext.Events.AddAsync(newEvent);
            await _dbContext.SaveChangesAsync();

            await _auditLogService.LogAsync(
                studentId, null, null, "student",
                "Event",
                "Create",
                newEvent.Title
            );

            return new GlobalResponse { Success = true, BackendMessage = "Event created successfully.", Data = newEvent };
        }

        public async Task<GlobalResponse> UpdateEventStatus(int eventId, int userId, string userRole, EventStatusUpdateRequest req)
        {
            var targetEvent = await _dbContext.Events.FirstOrDefaultAsync(e => e.EventId == eventId);
            if (targetEvent == null)
                return new GlobalResponse { Success = false, BackendMessage = "Invalid Event ID.", Data = null };
            if (targetEvent.Status == req.Status)
                return new GlobalResponse { Success = false, BackendMessage = "Event is already " + req.Status + ". Cannot update.", Data = null };
            if (userRole == "faculty")
            {
                if (targetEvent.Status == "pending" && (req.Status == "approved" || req.Status == "rejected"))
                {
                    targetEvent.Status = req.Status;
                    targetEvent.FacultyId = userId;
                    targetEvent.Reason = req.Reason;
                    await _dbContext.SaveChangesAsync();

                    await _auditLogService.LogAsync(
                        userId, null, null, "faculty",
                        "Event",
                        req.Status == "approved" ? "Approve" : "Reject",
                        targetEvent.Title
                    );

                    await _notificationService.NotifyOnStatusChange(targetEvent, req.Reason, userRole);
                }
                else return new GlobalResponse { Success = false, BackendMessage = "Faculty cannot update the Event's status to " + req.Status + " because it is already " + targetEvent.Status + " .", Data = null };
            }
            else if (userRole == "student")
            {
                if (req.Status == "cancelled" && (targetEvent.Status == "pending" || targetEvent.Status == "approved"))
                {
                    targetEvent.Status = req.Status;
                    targetEvent.Reason = req.Reason;
                    await _dbContext.SaveChangesAsync();

                    await _auditLogService.LogAsync(
                        userId, null, null, "student",
                        "Event",
                        "Cancel",
                        targetEvent.Title
                    );

                    if (targetEvent.Status == "approved")
                        await _notificationService.NotifyOnStatusChange(targetEvent, req.Reason, userRole);
                }
                else return new GlobalResponse { Success = false, BackendMessage = "Student cannot update the Event's status to " + req.Status + " because it is already " + targetEvent.Status + " .", Data = null };
            }
            return new GlobalResponse { Success = true, BackendMessage = "Event status updated successfully." };
        }
    }
}