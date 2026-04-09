public class AuthResult
{
    public bool IsSuccess { get; set; }
    public string Message { get; set; }
    public string Token { get; set; }
    public DateTime? ExpiresAtUtc { get; set; }
    public string UserId { get; set; }
    public string Email { get; set; }
    public string FullName { get; set; } // 👈 تأكد من وجود ده
    public string[] Roles { get; set; }
    public string[] Errors { get; set; }
}