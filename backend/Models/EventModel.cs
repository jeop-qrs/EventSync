using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models
{
    public class Event
    {
        [Key] // Primary Key
        public int EventId { get; set; }

        // Organizer (Student)
        [ForeignKey("User")] // Foreign Key -> Users(UserId)
        public int OrganizerId { get; set; }
        public User? Organizer { get; set; }

        // NEW: Required to match the EventCreateRequest DTO
        public int VenueId { get; set; }
        
        // NEW: Required to store the uploaded PDF path from the EventService
        public string? SubmitLetterPath { get; set; }

        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime StartDateTime { get; set; }
        public DateTime EndDateTime { get; set; }
        public int ExpectedAttendees { get; set; }
        
        // ADJUSTED: Made non-nullable with a default value
        public string Status { get; set; } = "pending"; // pending | approved | rejected | cancelled
        
        public string? Reason { get; set; } // Rejection reason or cancellation reason
        public DateTime CreatedAt { get; set; } // When the event was created
        public DateTime? UpdatedAt { get; set; } // Updates when cancelled, rejected, or approved
    }
}