using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;


namespace backend.Models
{
    public class Venue
    {
        [Key] // Primary Key
        public int VenueId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public string? Status { get; set; } // Available, Not Available (based on current capacity of Venue)
    }

    public class VenueBooking
    {
        [Key] // Primary Key
        public int VenueBookingId { get; set; }

        [ForeignKey("Event")] // Event that requested the venue
        public int EventId { get; set; }
        public Event? Event { get; set; }

        [ForeignKey("Venue")] // Venue that was requested
        public int VenueId { get; set; }
        public Venue? Venue { get; set; }

        [ForeignKey("Faculty")] // Reviewer (Faculty) that reviews the venue booking request
        public int? FacultyId { get; set; }
        public User? Faculty { get; set; }

        public string? Status { get; set; } // Pending | Approved | Rejected | Cancelled
        public DateTime? CreatedAt { get; set; } // When the Venue Booking Request was created
    }
}