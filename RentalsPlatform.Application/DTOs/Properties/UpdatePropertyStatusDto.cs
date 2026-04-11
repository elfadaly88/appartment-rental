namespace RentalsPlatform.Application.DTOs.Properties;

public sealed record UpdatePropertyStatusDto(
    bool IsActive,
    string? Reason = null);