namespace RentalsPlatform.Application.DTOs.Reviews;

public record ReviewDto(
    Guid Id,
    Guid BookingId,
    string GuestId,
    int Rating,
    string Comment,
    DateTime CreatedAt);
