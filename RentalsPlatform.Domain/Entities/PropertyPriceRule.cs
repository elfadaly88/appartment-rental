namespace RentalsPlatform.Domain.Entities;

public class PropertyPriceRule
{
    public Guid Id { get; private set; }
    public Guid PropertyId { get; private set; }
    public DateOnly StartDate { get; private set; }
    public DateOnly EndDate { get; private set; }
    public decimal CustomPricePerNight { get; private set; }

    public Property Property { get; private set; } = null!;

    private PropertyPriceRule() { }

    public PropertyPriceRule(Guid propertyId, DateOnly startDate, DateOnly endDate, decimal customPricePerNight)
    {
        if (startDate > endDate)
            throw new ArgumentException("StartDate must be before or equal to EndDate.");

        if (customPricePerNight <= 0)
            throw new ArgumentException("CustomPricePerNight must be greater than zero.");

        Id = Guid.NewGuid();
        PropertyId = propertyId;
        StartDate = startDate;
        EndDate = endDate;
        CustomPricePerNight = customPricePerNight;
    }
}
