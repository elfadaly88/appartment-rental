namespace RentalsPlatform.Application.DTOs.Bookings;

public record HostPipelineBookingDto(
    Guid Id,
    Guid PropertyId,
    string PropertyTitle,
    Guid GuestId,
    string GuestName,
    string GuestEmail,
    string? GuestAvatarUrl,
    DateOnly CheckInDate,
    DateOnly CheckOutDate,
    decimal TotalPrice,
    decimal NetProfit,
    string Currency,
    string PipelineStatus,
    DateTime? SoftBlockUntil);

