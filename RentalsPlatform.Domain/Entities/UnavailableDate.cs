namespace RentalsPlatform.Domain.Entities;

public class UnavailableDate
{
    public Guid Id { get; private set; }
    public Guid PropertyId { get; private set; }
    public DateOnly StartDate { get; private set; }
    public DateOnly EndDate { get; private set; }
    public string? Reason { get; private set; }

    /// <summary>
    /// Links this block to a specific booking.
    /// Null  → manual host block (calendar blackout).
    /// Non-null → system soft-block created when a booking is approved and
    ///            is awaiting guest payment within the 24-hour window.
    /// </summary>
    public Guid? BookingId { get; private set; }

    private UnavailableDate() { }

    /// <summary>Manual host block — no associated booking.</summary>
    public UnavailableDate(Guid propertyId, DateOnly startDate, DateOnly endDate, string? reason)
    {
        if (startDate >= endDate)
            throw new ArgumentException("End date must be after start date.");

        Id = Guid.NewGuid();
        PropertyId = propertyId;
        StartDate = startDate;
        EndDate = endDate;
        Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        BookingId = null;
    }

    /// <summary>
    /// System-generated soft block linked to a booking approval.
    /// These records are automatically removed when the booking is cancelled,
    /// rejected, or expires.
    /// </summary>
    public UnavailableDate(Guid propertyId, DateOnly startDate, DateOnly endDate, string? reason, Guid bookingId)
        : this(propertyId, startDate, endDate, reason)
    {
        BookingId = bookingId;
    }
}

