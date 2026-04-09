namespace RentalsPlatform.Application.DTOs.Properties;

public class CreatePropertyPriceRuleDto
{
    public DateOnly StartDate { get; init; }
    public DateOnly EndDate { get; init; }
    public decimal CustomPricePerNight { get; init; }
}
