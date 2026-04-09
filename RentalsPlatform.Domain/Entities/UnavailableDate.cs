namespace RentalsPlatform.Domain.Entities;

public class UnavailableDate
{
    public Guid Id { get; private set; }
    public Guid PropertyId { get; private set; }
    public DateOnly StartDate { get; private set; }
    public DateOnly EndDate { get; private set; }
    public string? Reason { get; private set; }

    private UnavailableDate() { }

    public UnavailableDate(Guid propertyId, DateOnly startDate, DateOnly endDate, string? reason)
    {
        if (startDate >= endDate)
            throw new ArgumentException("End date must be after start date.");

        Id = Guid.NewGuid();
        PropertyId = propertyId;
        StartDate = startDate;
        EndDate = endDate;
        Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
    }
}
