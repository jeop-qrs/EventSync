using backend.Models;

namespace backend.DTO
{
    public class DashboardStudentResponseDto
    {
        public int ProposedEvents { get; set; }
        public int PendingApproval { get; set; }
        public int AvailableVenues { get; set; }
        public int CancelledEvents { get; set; }
        public List<Event> MySubmittedEvents { get; set; } = [];
    }

    public class DashboardFacultyResponseDto
    {
        public int TotalActiveEvents { get; set; }
        public int PendingApproval { get; set; }
        public int AvailableVenuesToday { get; set; }
        public int RejectedEvents { get; set; }
        public List<Event> TrackedEvents { get; set; } = [];
    }
}
