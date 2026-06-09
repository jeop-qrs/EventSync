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
    public class AuthRefreshRequest
    {
        public string RefreshToken { get; set; } = string.Empty;
    }
    public class AuthDataObjectResponse
    {
        public string? Username { get; set; }
        public string? Role { get; set; }
        public string? AccessToken { get; set; }
        public int ExpiresIn { get; set; }
        public string? RefreshToken { get; set; }
    }
}