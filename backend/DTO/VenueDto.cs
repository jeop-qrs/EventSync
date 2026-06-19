namespace backend.DTO
{
    public class VenueCreateDto
    {
        public string Name { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public string Description { get; set; } = string.Empty;
        public string Availability { get; set; } = string.Empty;
        public List<string> Timeslots { get; set; } = [];
        public IFormFile? PhotoCover { get; set; }
        public string? Facilities { get; set; }
    }

    public class VenueResponseDto
    {
        public int VenueId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public string Description { get; set; } = string.Empty;
        public string Availability { get; set; } = string.Empty;
        public List<string> Timeslots { get; set; } = [];
        public string Status { get; set; } = string.Empty;
        public string PhotoPath { get; set; } = string.Empty;
        public string Facilities { get; set; } = string.Empty;
    }
}