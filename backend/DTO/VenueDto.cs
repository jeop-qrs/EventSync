namespace backend.DTO
{
    public class VenueCreateDto
    {
        public string Name { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public string Description { get; set; } = string.Empty;
        public string Availability { get; set; } = string.Empty;
        public List<TimeSlotsDto> Timeslots { get; set; } = [];
        public IFormFile PhotoCover { get; set; } = null!;
    }

    public class VenueResponseDto
    {
        public int VenueId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public string Description { get; set; } = string.Empty;
        public string Availability { get; set; } = string.Empty;
        public List<TimeSlotsDto> Timeslots { get; set; } = [];
        public string Status { get; set; } = string.Empty;
        public string PhotoPath { get; set; } = string.Empty;
    }

    public class TimeSlotsDto
    {
        public string StartTime { get; set; } = string.Empty;
        public string EndTime { get; set; } = string.Empty;
    }
}