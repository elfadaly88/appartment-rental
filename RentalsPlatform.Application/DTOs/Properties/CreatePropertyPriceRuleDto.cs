namespace RentalsPlatform.Application.DTOs.Properties;

public class CreatePropertyPriceRuleDto
{
    public DateOnly StartDate { get; init; }
    public DateOnly EndDate { get; init; }
    public decimal CustomPrice { get; init; }
    /// <summary>Optional human-readable label for this season.</summary>
    public string? Label { get; init; }
}
