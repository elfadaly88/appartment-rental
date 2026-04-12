using RentalsPlatform.Domain.Enums;

namespace RentalsPlatform.Application.DTOs.Properties;

public sealed record HostPropertySummaryDto(
    Guid Id,
    string Title,
    string Description,
    string City,
    string Country,
    decimal PricePerNight,
    decimal? ServiceFeePercentage,
    decimal? TaxPercentage,
    string Currency,
    int MaxGuests,
    PropertyStatus Status,
    string? ThumbnailUrl,
    string? RejectionReason,
    DateTime SubmittedAt);