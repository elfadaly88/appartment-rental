using RentalsPlatform.Domain.Enums;

namespace RentalsPlatform.Application.DTOs.Bookings;

public record HostBookingDto(
    Guid Id,
    string PropertyName,
    string GuestName,
    string? GuestPhoneMasked,
    string? GuestPhoneFull,
    bool IsGuestPhoneVerified,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal TotalPrice,
    BookingStatus Status);
