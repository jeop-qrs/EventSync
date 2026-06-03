namespace backend.DTO.Auth
{
    public class LoginReq
    {
        public string StudNo { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class LoginRes
    {
        public bool Success { get; set; } = false;
        public string Message { get; set; } = string.Empty;
        public string AccessToken { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
    }
}