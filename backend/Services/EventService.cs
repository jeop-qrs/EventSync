// ------------------------------------------------------------
// File: EventService.cs
// Purpose: Business logic for Event CRUD and Status updates
// ------------------------------------------------------------

using backend.Data;
using backend.DTO;
using backend.Models; // Required to access the Event model
using Microsoft.EntityFrameworkCore; // Required for EF Core extensions like .ToListAsync()

namespace backend.Services
{
    public class EventService
    {
        // Injecting the database context
        private readonly AppDbContext _dbContext;

        public EventService(AppDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        // GET /api/events
        public async Task<GlobalResponse> GetAllEvents()
        {
            // Fetch directly from the SQL database and map to DTO
            var events = await _dbContext.Events
                .Select(e => new EventResponseDto
                {
                    EventId = e.EventId,
                    OrganizerId = e.OrganizerId,
                    Title = e.Title,
                    Description = e.Description,
                    StartDateTime = e.StartDateTime,
                    EndDateTime = e.EndDateTime,
                    ExpectedAttendees = e.ExpectedAttendees,
                    Status = e.Status,
                    Reason = e.Reason,
                    CreatedAt = e.CreatedAt,
                    UpdatedAt = e.UpdatedAt ?? e.CreatedAt
                })
                .ToListAsync(); 

            return new GlobalResponse
            {
                Success = true,
                BackendMessage = "Events fetched.",
                Data = new { events = events } 
            };
        }

        // GET /api/events/filter?filter={status}
        public async Task<GlobalResponse> GetEventsByFilter(string filter)
        {
            // Fetch events where the Status matches the filter (case-insensitive)
            var filteredEvents = await _dbContext.Events
                .Where(e => e.Status.ToLower() == filter.ToLower())
                .Select(e => new EventResponseDto
                {
                    EventId = e.EventId,
                    OrganizerId = e.OrganizerId,
                    Title = e.Title,
                    Description = e.Description,
                    StartDateTime = e.StartDateTime,
                    EndDateTime = e.EndDateTime,
                    ExpectedAttendees = e.ExpectedAttendees,
                    Status = e.Status,
                    Reason = e.Reason,
                    CreatedAt = e.CreatedAt,
                    UpdatedAt = e.UpdatedAt ?? e.CreatedAt
                })
                .ToListAsync();

            if (!filteredEvents.Any())
            {
                return new GlobalResponse 
                { 
                    Success = false, 
                    BackendMessage = $"No events found with status: {filter}", 
                    Data = null 
                };
            }

            return new GlobalResponse
            {
                Success = true,
                BackendMessage = "Events fetched.",
                Data = new { events = filteredEvents }
            };
        }

        // POST /api/events
        public async Task<GlobalResponse> CreateEvent(EventCreateRequest req, int studentId)
        {
            // 1. Handle the PDF File Upload
            string? savedFilePath = null;

            if (req.SubmitLetter != null && req.SubmitLetter.Length > 0)
            {
                var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");

                if (!Directory.Exists(uploadsFolder))
                {
                    Directory.CreateDirectory(uploadsFolder);
                }

                var uniqueFileName = Guid.NewGuid().ToString() + "_" + req.SubmitLetter.FileName;
                var filePath = Path.Combine(uploadsFolder, uniqueFileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await req.SubmitLetter.CopyToAsync(stream);
                }

                savedFilePath = $"/uploads/{uniqueFileName}";
            }

            // 2. Save the Event to the Database using EF Core
            var newEvent = new Event
            {
                OrganizerId = studentId,
                VenueId = req.VenueId,
                SubmitLetterPath = savedFilePath, // Saved from the file upload block
                Title = req.Title,
                Description = req.Description,
                StartDateTime = req.StartDateTime,
                EndDateTime = req.EndDateTime,
                ExpectedAttendees = req.ExpectedAttendees,
                Status = "pending",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _dbContext.Events.Add(newEvent);
            await _dbContext.SaveChangesAsync(); // Actually executes the SQL INSERT

            // 3. Map back to Response DTO to show the user
            var newEventResponse = new EventResponseDto
            {
                EventId = newEvent.EventId, // EF automatically populates this after SaveChangesAsync
                OrganizerId = newEvent.OrganizerId,
                Title = newEvent.Title,
                Description = newEvent.Description,
                StartDateTime = newEvent.StartDateTime,
                EndDateTime = newEvent.EndDateTime,
                ExpectedAttendees = newEvent.ExpectedAttendees,
                Status = newEvent.Status,
                CreatedAt = newEvent.CreatedAt,
                UpdatedAt = newEvent.UpdatedAt ?? newEvent.CreatedAt
            };

            return new GlobalResponse
            {
                Success = true,
                BackendMessage = "Event created successfully.",
                Data = newEventResponse
            };
        }

        // PATCH /api/events/{eventId}/status
        public async Task<GlobalResponse> UpdateEventStatus(int eventId, EventStatusUpdateRequest req, int userId, string userRole)
        {
            // 1. Fetch the event from the database
            var existingEvent = await _dbContext.Events.FindAsync(eventId);
            if (existingEvent == null) 
            {
                return new GlobalResponse { Success = false, BackendMessage = "Event not found." };
            }

            // 2. Logic gates for Role-Based Actions
            if (userRole == "Student")
            {
                if (req.Status != "cancelled") return new GlobalResponse { Success = false, BackendMessage = "Students can only cancel events." };
                if (existingEvent.OrganizerId != userId) return new GlobalResponse { Success = false, BackendMessage = "You can only cancel your own events." };
            }

            if (userRole == "Faculty" && (req.Status != "approved" && req.Status != "rejected"))
            {
                return new GlobalResponse { Success = false, BackendMessage = "Faculty can only approve or reject events." };
            }

            // 3. Update the tracking fields
            existingEvent.Status = req.Status;
            existingEvent.Reason = req.Reason;
            existingEvent.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync(); // Executes the SQL UPDATE

            // 4. Map back to DTO
            var updatedResponse = new EventResponseDto
            {
                EventId = existingEvent.EventId,
                OrganizerId = existingEvent.OrganizerId,
                Title = existingEvent.Title,
                Description = existingEvent.Description,
                StartDateTime = existingEvent.StartDateTime,
                EndDateTime = existingEvent.EndDateTime,
                ExpectedAttendees = existingEvent.ExpectedAttendees,
                Status = existingEvent.Status,
                Reason = existingEvent.Reason,
                CreatedAt = existingEvent.CreatedAt,
                UpdatedAt = existingEvent.UpdatedAt ?? existingEvent.CreatedAt
            };

            return new GlobalResponse
            {
                Success = true,
                BackendMessage = userRole == "Student" ? "Event is cancelled." : "Event status updated successfully.",
                Data = updatedResponse
            };
        }

        // DELETE /api/events/{eventId}
        public async Task<GlobalResponse> DeleteEvent(int eventId, int studentId)
        {
            var existingEvent = await _dbContext.Events.FindAsync(eventId);
            if (existingEvent == null)
            {
                 return new GlobalResponse { Success = false, BackendMessage = "Event not found." };
            }

            // Security check: ensure the student deleting it actually owns it
            if (existingEvent.OrganizerId != studentId)
            {
                return new GlobalResponse { Success = false, BackendMessage = "Unauthorized to delete this event." };
            }

            _dbContext.Events.Remove(existingEvent);
            await _dbContext.SaveChangesAsync(); // Executes the SQL DELETE

            return new GlobalResponse
            {
                Success = true,
                BackendMessage = "Event deleted successfully.",
                Data = null // No data needed to be returned on a hard delete
            };
        }
    }
}