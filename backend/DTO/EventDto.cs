namespace backend.DTO
{
    public class EventResponseDto
    {
        public int EventId { get; set; }
        public int OrganizerId { get; set; }
        public int? FacultyId { get; set; }
        public int VenueId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public DateTime EventDate { get; set; }
        public TimeOnly StartTime { get; set; }
        public int ExpectedAttendees { get; set; }
        public string SubmitLetterPath { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class EventCreateRequest
    {
        public string Title { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public int VenueId { get; set; }
        public DateTime EventDate { get; set; }
        public TimeOnly StartTime { get; set; }
        public int ExpectedAttendees { get; set; }
        public IFormFile SubmitLetter { get; set; } = null!;
    }

    public class EventStatusUpdateRequest
    {
        public string Status { get; set; } = string.Empty; // "approved", "rejected", "cancelled"
        public string? Reason { get; set; }
    }
}