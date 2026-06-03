namespace backend.DTO.Auth
{
    public class RegisterReq
    {
        public string StudNo { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty; // "Student" or "Faculty"
    }

    public class RegisterRes
    {
        public bool Success { get; set; } = false;
        public string Message { get; set; } = string.Empty;
    }
}