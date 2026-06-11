using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;



namespace backend.Models
{
    public class Notification
    {
        [Key] // Primary Key
        public int NotificationId { get; set; }

        [ForeignKey("User")]
        public int UserId { get; set; }
        public User? User { get; set; }

        [ForeignKey("Event")]
        public int EventId { get; set; }
        public Event? Event { get; set; }

        public string Message { get; set; } = string.Empty;
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class NotificationPreference
    {
        [Key] // Primary Key
        public int NotificationPreferenceId { get; set; }

        [ForeignKey("User")]
        public int UserId { get; set; }
        public User? User { get; set; }

        public bool NotifyOneDayBefore { get; set; } = true;
        public bool NotifyOneWeekBefore { get; set; } = true;
        public bool NotifyOnStatusChange { get; set; } = true;
        public DateTime LastUpdated { get; set; }
    }
}