namespace RentalsPlatform.Application.DTOs.Auth;

public class AuthResult
{
    public bool IsSuccess { get; set; }
    public string Message { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public DateTime? ExpiresAtUtc { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string[] Roles { get; set; } = [];
    public string[] Errors { get; set; } = [];
    public string? Provider { get; set; }
    public AuthUserDto? User { get; set; }
}