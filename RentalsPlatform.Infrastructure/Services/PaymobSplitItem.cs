namespace RentalsPlatform.Infrastructure.Services;

public class PaymobSplitItem
{
    public string SubMerchantId { get; init; } = string.Empty;
    public int SplitPercentage { get; init; }
    public int SplitAmountCents { get; init; }
}
