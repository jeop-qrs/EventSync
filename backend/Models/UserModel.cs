using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;


namespace backend.Models
{
    public class User
    {
        // Shared attributes for student and faculty
        [Key]
        public int UserId { get; set; }
        public string? FullName { get; set; }
        public string PasswordHash { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;

        // For student
        public string? StudentNumber { get; set; }
        // For Faculty
        public string? Username { get; set; }

        public string? RefreshToken { get; set; }
        public DateTime? RefreshTokenExpiry { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}