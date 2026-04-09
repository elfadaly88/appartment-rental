namespace RentalsPlatform.Application.DTOs.Admin;

public class AdminUserDto
{
    public string Id { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string Role { get; init; } = string.Empty;
    public bool IsBanned { get; init; }
    public string? BanReason { get; init; }
    public DateTime CreatedAt { get; init; }
}
