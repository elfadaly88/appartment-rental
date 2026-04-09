namespace RentalsPlatform.Domain.ValueObjects;

// عزل الفلوس في كائن لوحده هيسهل علينا مستقبلاً لو حبينا ندعم أكتر من عملة في المنصة
public record Money(
    decimal Amount,
    string Currency)
{
    // نقدر نضيف Business Rules صغيرة هنا
    public static Money Zero(string currency = "EGP") => new(0, currency);

    public bool IsGreaterThanZero() => Amount > 0;
}