namespace RentalsPlatform.Application.DTOs.Payments;

public sealed class InitiatePaymobResponseDto
{
    public Guid BookingId { get; init; }
    public string OrderId { get; init; } = string.Empty;
    public string PaymentKey { get; init; } = string.Empty;
    public string PublicKey { get; init; } = string.Empty;
    public string CheckoutUrl { get; init; } = string.Empty;
    public string CallbackUrl { get; init; } = string.Empty;
}
