namespace RentalsPlatform.Application.DTOs.Bookings;

public record BlockDatesDto(
    Guid PropertyId,
    DateOnly StartDate,
    DateOnly EndDate,
    string? Reason);
