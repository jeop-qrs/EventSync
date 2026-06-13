namespace backend.DTO
{
    public class NotificationUpdatePreferenceDto
    {
        public bool NotifyOneDayBefore { get; set; }
        public bool NotifyOneWeekBefore { get; set; }
        public bool NotifyOnStatusChange { get; set; }
    }
}