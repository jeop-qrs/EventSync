using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;


namespace backend.Models
{
    public class Venue
    {
        [Key] // Primary Key
        public int VenueId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public string Description { get; set; } = string.Empty;
        public string Availability { get; set; } = string.Empty; // List of days that the venue is available (e.g., Monday, Tuesday, etc.)
        public List<string> DailyTimeSlots { get; set; } = []; // Max of 3 time slots each day (with max of 3 hours occupancy per slot)
        public string Status { get; set; } = "available"; // Available, Not Available (based on capacity, avai)
        public string? PhotoPath { get; set; } // Path to the photo of the venue
    }
}