using RentalsPlatform.Domain.Enums;

namespace RentalsPlatform.Application.DTOs.Properties;

public sealed record HostDashboardDto(
    decimal TotalEarnings,
    decimal ProjectedIncome,
    int ActiveListings,
    decimal OccupancyRate,
    IReadOnlyCollection<HostPropertySummaryDto> Properties,
    IReadOnlyCollection<HostBookingOverviewDto> Bookings);

public sealed record HostBookingOverviewDto(
    Guid Id,
    Guid PropertyId,
    string PropertyTitle,
    string GuestName,
    DateOnly CheckInDate,
    DateOnly CheckOutDate,
    decimal TotalPrice,
    string Currency,
    BookingStatus Status,
    PaymentStatus PaymentStatus);