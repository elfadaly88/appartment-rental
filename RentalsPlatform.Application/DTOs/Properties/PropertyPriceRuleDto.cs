namespace RentalsPlatform.Application.DTOs.Properties;

public class PropertyPriceRuleDto
{
    public Guid Id { get; init; }
    public DateOnly StartDate { get; init; }
    public DateOnly EndDate { get; init; }
    /// <summary>Custom nightly price for this seasonal rule.</summary>
    public decimal CustomPrice { get; init; }
    /// <summary>Human-readable season label, e.g. "Eid", "Summer Peak".</summary>
    public string? Label { get; init; }
}
