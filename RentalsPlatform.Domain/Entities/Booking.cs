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

    /// <summary>Timestamp when the host approved. Used for the 24-hour payment window.</summary>
    public DateTime? ApprovedAt { get; private set; }

    public Property Property { get; private set; } = null!;

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

    public void SetTotalPrice(decimal amount, string currency)
    {
        if (amount < 0)
            throw new ArgumentOutOfRangeException(nameof(amount), "Total amount cannot be negative.");

        TotalPrice = new Money(amount, currency);
    }

    public void MarkPaymentPaid()
    {
        PaymentStatus = PaymentStatus.Paid;
    }

    public void MarkPaymentFailed()
    {
        PaymentStatus = PaymentStatus.Failed;
    }

    /// <summary>Host approves → soft-blocks dates & opens 24 h payment window.</summary>
    public void Approve()
    {
        if (Status != BookingStatus.Pending)
            throw new InvalidOperationException("Only pending bookings can be approved.");

        Status = BookingStatus.Approved;
        ApprovedAt = DateTime.UtcNow;
    }

    /// <summary>Guest completes payment → booking fully Confirmed.</summary>
    public void Confirm()
    {
        if (Status != BookingStatus.Approved && Status != BookingStatus.Pending)
            throw new InvalidOperationException("Only approved or pending bookings can be confirmed.");

        Status = BookingStatus.Confirmed;
    }

    /// <summary>Host rejects or otherwise cancels the booking.</summary>
    public void Cancel()
    {
        Status = BookingStatus.Cancelled;
    }

    public void Reject(string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Rejection reason is required.", nameof(reason));

        Status = BookingStatus.Cancelled;
        Reason = reason.Trim();
    }

    /// <summary>Guest cancels a Pending or Approved booking.</summary>
    public void GuestCancel()
    {
        if (Status != BookingStatus.Pending && Status != BookingStatus.Approved)
            throw new InvalidOperationException("Only pending or approved bookings can be cancelled by the guest.");

        Status = BookingStatus.Cancelled;
    }

    /// <summary>System expires an Approved booking when 24 h pass without payment.</summary>
    public void Expire()
    {
        if (Status != BookingStatus.Approved)
            throw new InvalidOperationException("Only approved bookings can be expired.");

        Status = BookingStatus.Expired;
    }
}