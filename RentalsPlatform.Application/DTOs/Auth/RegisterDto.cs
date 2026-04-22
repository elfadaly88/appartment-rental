namespace RentalsPlatform.Application.DTOs.Auth;

public record RegisterDto(
    string FullName,
    string Email,
    string Password,
    string? ProfilePictureUrl = null,
    bool AcceptedHostTerms = false);
