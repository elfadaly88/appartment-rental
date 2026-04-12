namespace RentalsPlatform.Application.DTOs.Payments;

public sealed class InitiatePaymobRequestDto
{
    public Guid BookingId { get; init; }
}
