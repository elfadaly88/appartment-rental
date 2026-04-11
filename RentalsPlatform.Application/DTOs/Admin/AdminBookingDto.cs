using RentalsPlatform.Domain.Enums;

namespace RentalsPlatform.Application.DTOs.Admin;

public class AdminBookingDto
{
    public Guid Id { get; init; }
    public Guid PropertyId { get; init; }
    public string PropertyTitle { get; init; } = string.Empty;
    public string HostName { get; init; } = string.Empty;
    public string GuestEmail { get; init; } = string.Empty;
    public DateOnly StartDate { get; init; }
    public DateOnly EndDate { get; init; }
    public decimal TotalPrice { get; init; }
    public string Currency { get; init; } = "USD";
    public BookingStatus BookingStatus { get; init; }
    public PaymentStatus PaymentStatus { get; init; }
    public bool IsPaid { get; init; }
    public string PaymentProvider { get; init; } = string.Empty;
    public string? TransactionId { get; init; }
    public DateTime CreatedOnUtc { get; init; }
}
