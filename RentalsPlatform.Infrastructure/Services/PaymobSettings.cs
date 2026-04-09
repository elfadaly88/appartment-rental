namespace RentalsPlatform.Infrastructure.Services;

public class PaymobSettings
{
    public string ApiKey { get; init; } = string.Empty;
    public string HmacSecret { get; init; } = string.Empty;
    public int IntegrationId { get; init; }
    public int IframeId { get; init; }
    public string BaseUrl { get; init; } = "https://accept.paymob.com/api";
}
