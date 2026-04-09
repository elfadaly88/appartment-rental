using RentalsPlatform.Domain.Enums;

namespace RentalsPlatform.Application.DTOs.Admin;

public class AdminPropertyDto
{
    public Guid Id { get; init; }
    public string HostName { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public IReadOnlyCollection<string> Images { get; init; } = Array.Empty<string>();
    public PropertyStatus Status { get; init; }
    public DateTime SubmittedAt { get; init; }
}
