using Microsoft.AspNetCore.Http;

namespace RentalsPlatform.Application.DTOs.Properties;

public record CreatePropertyDto
{
    public string NameAr { get; init; } = string.Empty;
    public string NameEn { get; init; } = string.Empty;
    public string DescriptionAr { get; init; } = string.Empty;
    public string DescriptionEn { get; init; } = string.Empty;
    public decimal PricePerNight { get; init; }
    public int MaxGuests { get; init; } = 1;
    public IFormFileCollection Images { get; init; } = null!;
}
