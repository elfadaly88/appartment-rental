namespace RentalsPlatform.Application.DTOs.Public;

public sealed record FeaturedPropertyDto(
    Guid   Id,
    string Title,
    string City,
    string Country,
    decimal PricePerNight,
    string Currency,
    string? ThumbnailUrl,
    int    MaxGuests);

public sealed record FeaturedPropertiesResultDto(
    IReadOnlyList<FeaturedPropertyDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    IReadOnlyList<string> AvailableCities);
