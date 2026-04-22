namespace RentalsPlatform.Application.DTOs.Auth;

public record ExternalLoginDto(
    string Provider,
    string AccessToken,
    string? IdToken = null,
    string? Role = null,
    bool AcceptedHostTerms = false);