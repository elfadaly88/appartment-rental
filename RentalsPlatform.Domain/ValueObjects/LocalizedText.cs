namespace RentalsPlatform.Domain.ValueObjects;

public record LocalizedText
{
    public string Ar { get; init; }
    public string En { get; init; }

    private LocalizedText() { } // عشان EF Core

    public LocalizedText(string ar, string en)
    {
        if (string.IsNullOrWhiteSpace(ar) || string.IsNullOrWhiteSpace(en))
            throw new ArgumentException("Both Arabic and English texts are required.");

        Ar = ar;
        En = en;
    }

    // دالة ذكية بترجع النص حسب اللغة المطلوبة
    public string GetText(string languageCode)
    {
        return languageCode.ToLower().StartsWith("ar") ? Ar : En;
    }
}