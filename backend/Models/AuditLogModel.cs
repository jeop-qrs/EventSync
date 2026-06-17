using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models
{
    public class AuditLog
    {
        [Key]
        public int AuditLogId { get; set; }

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        public int? UserId { get; set; }

        public string UserIdentifier { get; set; } = "Anonymous";

        public string UserFullName { get; set; } = "Anonymous";

        public string Role { get; set; } = "Anonymous";

        public string IpAddress { get; set; } = string.Empty;

        public string ObjectType { get; set; } = string.Empty;

        public string Action { get; set; } = string.Empty;

        public string ObjectName { get; set; } = string.Empty;

        public string Url { get; set; } = string.Empty;
    }
}
