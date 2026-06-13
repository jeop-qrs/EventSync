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

        [ForeignKey("Faculty")]
        public int? FacultyId { get; set; }
        public User? Faculty { get; set; }

        [ForeignKey("Venue")]
        public int VenueId { get; set; }
        public Venue? Venue { get; set; }

        public string Title { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public DateTime EventDate { get; set; }
        public TimeOnly StartTime { get; set; }
        public int ExpectedAttendees { get; set; }
        public string SubmitLetterPath { get; set; } = string.Empty;
        public string Status { get; set; } = "pending"; // pending | approved | rejected | cancelled | 
        public string? Reason { get; set; } // Optional reason for event cancellation or rejection
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}