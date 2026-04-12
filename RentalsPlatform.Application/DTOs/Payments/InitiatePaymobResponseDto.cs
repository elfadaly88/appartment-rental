namespace RentalsPlatform.Application.DTOs.Payments;

public sealed class InitiatePaymobResponseDto
{
    public Guid BookingId { get; init; }
    public string OrderId { get; init; } = string.Empty;
    public string PaymentKey { get; init; } = string.Empty;
    public int IframeId { get; init; }
    public string CheckoutUrl { get; init; } = string.Empty;
}
