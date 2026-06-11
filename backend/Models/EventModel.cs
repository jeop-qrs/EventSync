using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;


namespace backend.Models
{
    public class Event
    {
        [Key] // Primary Key
        public int EventId { get; set; }

        // Organizer (Student)
        [ForeignKey("Organizer")]
        public int OrganizerId { get; set; }
        public User? Organizer { get; set; }

        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime StartDateTime { get; set; }
        public DateTime EndDateTime { get; set; }
        public int ExpectedAttendees { get; set; }
        public string? Status { get; set; } // Pending | Approved | Rejected | Cancelled
        public string? Reason { get; set; } // Rejection reason or cancellation reason
        public DateTime CreatedAt { get; set; } // When the event was created
        public DateTime? UpdatedAt { get; set; } // Updates when cancelled, rejected, or approved
    }
}