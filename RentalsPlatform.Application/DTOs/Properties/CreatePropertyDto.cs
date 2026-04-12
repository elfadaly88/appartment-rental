using Microsoft.AspNetCore.Http;
using System.ComponentModel.DataAnnotations;

namespace RentalsPlatform.Application.DTOs.Properties;

public record CreatePropertyDto
{
    [Required]
    [MinLength(3)]
    public string NameAr { get; init; } = string.Empty;

    [Required]
    [MinLength(3)]
    public string NameEn { get; init; } = string.Empty;

    [Required]
    [MinLength(20)]
    public string DescriptionAr { get; init; } = string.Empty;

    [Required]
    [MinLength(20)]
    public string DescriptionEn { get; init; } = string.Empty;

    [Required]
    [MaxLength(80)]
    public string Category { get; init; } = string.Empty;

    [MaxLength(2000)]
    public string AmenitiesText { get; init; } = string.Empty;

    [MaxLength(2000)]
    public string HouseRules { get; init; } = string.Empty;

    [Required]
    public string Country { get; init; } = string.Empty;

    [Required]
    public string City { get; init; } = string.Empty;

    [Required]
    public string Street { get; init; } = string.Empty;

    [Required]
    public string ZipCode { get; init; } = string.Empty;

    [MaxLength(1000)]
    public string MapUrl { get; init; } = string.Empty;

    [Range(1, 1_000_000)]
    public decimal PricePerNight { get; init; }

    [Range(1, 100)]
    public int MaxGuests { get; init; } = 1;

    [Range(0, 100)]
    public decimal? ServiceFeePercentage { get; init; }

    [Range(0, 100)]
    public decimal? TaxPercentage { get; init; }

    public IFormFileCollection Images { get; init; } = null!;
}
