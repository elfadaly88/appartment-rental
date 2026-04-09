namespace RentalsPlatform.Application.DTOs.Properties;

public class PropertyPriceRuleDto
{
    public Guid Id { get; init; }
    public DateOnly StartDate { get; init; }
    public DateOnly EndDate { get; init; }
    public decimal CustomPricePerNight { get; init; }
}
