namespace RentalsPlatform.Application.DTOs.Calendar;

public record BlockDto(
    Guid PropertyId,
    DateOnly StartDate,
    DateOnly EndDate,
    string? Reason);
