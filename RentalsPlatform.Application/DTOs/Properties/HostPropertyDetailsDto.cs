using RentalsPlatform.Domain.Enums;

namespace RentalsPlatform.Application.DTOs.Properties;

public sealed record HostPropertyDetailsDto(
    Guid Id,
    string NameAr,
    string NameEn,
    string DescriptionAr,
    string DescriptionEn,
    string Country,
    string City,
    string Street,
    string ZipCode,
    string MapUrl,
    decimal PricePerNight,
    decimal? ServiceFeePercentage,
    decimal? TaxPercentage,
    string Currency,
    int MaxGuests,
    PropertyStatus Status,
    string? RejectionReason,
    IReadOnlyCollection<HostPropertyImageDto> Images,
    IReadOnlyCollection<HostBlockedDateDto> BlockedDates);

public sealed record HostPropertyImageDto(
    Guid Id,
    string Url,
    bool IsMain);

public sealed record HostBlockedDateDto(
    Guid Id,
    DateOnly StartDate,
    DateOnly EndDate,
    string? Reason);