using RentalsPlatform.Domain.Enums;

namespace RentalsPlatform.Application.DTOs.Bookings;

public record GuestBookingDto(
    Guid Id,
    Guid PropertyId,
    string PropertyTitle,
    string? PropertyThumbnailUrl,
    DateOnly CheckInDate,
    DateOnly CheckOutDate,
    int Nights,
    decimal TotalPrice,
    string Currency,
    BookingStatus Status,
    PaymentStatus PaymentStatus,
    DateTime? ApprovedAt
);

