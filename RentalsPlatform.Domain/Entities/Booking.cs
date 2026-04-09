using RentalsPlatform.Domain.Enums;
using RentalsPlatform.Domain.ValueObjects;

namespace RentalsPlatform.Domain.Entities;

public class Booking
{
    public Guid Id { get; private set; }
    public Guid PropertyId { get; private set; }
    public Guid GuestId { get; private set; }
    public DateOnly StartDate { get; private set; }
    public DateOnly EndDate { get; private set; }
    public Money TotalPrice { get; private set; }
    public BookingStatus Status { get; private set; }
    public PaymentStatus PaymentStatus { get; private set; }
    public string? PaymobOrderId { get; private set; }
    public string? Reason { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
    public Review? Review { get; private set; }

    private Booking() { }

    public Booking(Guid propertyId, Guid guestId, DateRange duration, Money pricePerNight)
    {
        Id = Guid.NewGuid();
        PropertyId = propertyId;
        GuestId = guestId;
        StartDate = duration.Start;
        EndDate = duration.End;
        Status = BookingStatus.Pending;
        PaymentStatus = PaymentStatus.Pending;
        CreatedOnUtc = DateTime.UtcNow;

        TotalPrice = new Money(
            pricePerNight.Amount * duration.LengthInDays,
            pricePerNight.Currency);
    }

    public static Booking CreateHostBlock(Guid propertyId, DateOnly startDate, DateOnly endDate, string? reason)
    {
        if (startDate >= endDate)
            throw new ArgumentException("End date must be after start date.");

        return new Booking
        {
            Id = Guid.NewGuid(),
            PropertyId = propertyId,
            GuestId = Guid.Empty,
            StartDate = startDate,
            EndDate = endDate,
            Status = BookingStatus.HostBlocked,
            PaymentStatus = PaymentStatus.Pending,
            Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim(),
            TotalPrice = Money.Zero(),
            CreatedOnUtc = DateTime.UtcNow
        };
    }

    public void SetPaymobOrderId(string paymobOrderId)
    {
        if (string.IsNullOrWhiteSpace(paymobOrderId))
            throw new ArgumentException("Paymob order id is required.", nameof(paymobOrderId));

        PaymobOrderId = paymobOrderId.Trim();
    }

    public void MarkPaymentPaid()
    {
        PaymentStatus = PaymentStatus.Paid;
    }

    public void MarkPaymentFailed()
    {
        PaymentStatus = PaymentStatus.Failed;
    }

    public void Confirm()
    {
        if (Status != BookingStatus.Pending)
            throw new InvalidOperationException("Only pending bookings can be confirmed");

        Status = BookingStatus.Confirmed;
    }

    public void Cancel()
    {
        Status = BookingStatus.Cancelled;
    }
}