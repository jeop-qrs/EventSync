// ------------------------------------------------------------
// File: EventDTOs.cs
// Purpose: Data transfer objects for Event requests and responses
// ------------------------------------------------------------

using Microsoft.AspNetCore.Http;

namespace backend.DTO
{
    // Matches your GET responses
    public class EventResponseDto
    {
        public int EventId { get; set; }
        public int OrganizerId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime StartDateTime { get; set; }
        public DateTime EndDateTime { get; set; }
        public int ExpectedAttendees { get; set; }
        public string Status { get; set; } = string.Empty; 
        public string? Reason { get; set; } // Nullable, as requested
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    // Matches POST /api/events 
    public class EventCreateRequest
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime StartDateTime { get; set; }
        public DateTime EndDateTime { get; set; }
        public int ExpectedAttendees { get; set; }
        public int VenueId { get; set; }
        
        // IFormFile handles the incoming PDF upload via multipart/form-data
        public IFormFile? SubmitLetter { get; set; } 
    }

    // Matches PATCH /api/events/{eventId}/status
    public class EventStatusUpdateRequest
    {
        public string Status { get; set; } = string.Empty; // "approved", "rejected", "cancelled"
        public string? Reason { get; set; }
    }
}