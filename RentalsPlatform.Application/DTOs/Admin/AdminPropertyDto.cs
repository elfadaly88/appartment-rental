using RentalsPlatform.Domain.Enums;

namespace RentalsPlatform.Application.DTOs.Admin;

public class AdminPropertyDto
{
    public Guid Id { get; init; }
    public string HostName { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public decimal PriceAmount { get; init; }
    public string PriceCurrency { get; init; } = "EGP";
    public int MaxGuests { get; init; }
    public double Area { get; init; }
    public int Bedrooms { get; init; }
    public int Bathrooms { get; init; }
    public IReadOnlyCollection<string> Amenities { get; init; } = Array.Empty<string>();
    public decimal ServiceFee { get; init; }
    public decimal SecurityDeposit { get; init; }
    public string Country { get; init; } = string.Empty;
    public string City { get; init; } = string.Empty;
    public string Street { get; init; } = string.Empty;
    public IReadOnlyCollection<string> Images { get; init; } = Array.Empty<string>();
    public PropertyStatus Status { get; init; }
    public DateTime SubmittedAt { get; init; }
}
