namespace backend.DTO
{
    public class AuthRegisterRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty; // "Student" or "Faculty"
    }
    public class AuthLoginRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }   
    public class AuthResponse
    {
        public bool Success { get; set; } = false;
        public string BackendMessage { get; set; } = string.Empty;
        public ObjectResponse? Data { get; set; }
    }

    public class RefreshRequest
    {
        public string Username { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
    }

    public class ObjectResponse
    {
        public string? Username { get; set; }
        public string? Role { get; set; }
        public string? AccessToken { get; set; }
        public int ExpiresIn { get; set; }
        public string? RefreshToken { get; set; }
    }
}