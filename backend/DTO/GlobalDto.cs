namespace backend.DTO
{
    public class GlobalResponse
    {
        public bool Success { get; set; } = false;
        public string BackendMessage { get; set; } = string.Empty;
        public object? Data { get; set; } // This object is allowed to be nullable.
    }
}