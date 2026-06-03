namespace backend.Models
{
    public class User
    {
        public int Id { get; set; }
        public string StudNo{ get; set; }
        public string PasswordHashed { get; set; }
        public string Role { get; set; }
    }
}