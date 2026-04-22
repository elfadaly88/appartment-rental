using System.Text;
using System.Text.RegularExpressions;

namespace RentalsPlatform.Application.Common;

public static class EgyptianPhoneNumber
{
    private static readonly Regex LocalMobileRegex = new("^01(0|1|2|5)\\d{8}$", RegexOptions.Compiled);

    public static string NormalizeToLocal(string? raw)
    {
        var digits = ExtractDigits(raw);
        if (string.IsNullOrWhiteSpace(digits))
            return string.Empty;

        if (digits.StartsWith("0020", StringComparison.Ordinal))
            digits = "0" + digits[4..];
        else if (digits.StartsWith("20", StringComparison.Ordinal))
            digits = "0" + digits[2..];

        return digits;
    }

    public static bool IsValidLocal(string? raw)
    {
        var normalized = NormalizeToLocal(raw);
        return LocalMobileRegex.IsMatch(normalized);
    }

    private static string ExtractDigits(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return string.Empty;

        var sb = new StringBuilder(raw.Length);
        foreach (var ch in raw)
        {
            if (char.IsDigit(ch))
                sb.Append(ch);
        }

        return sb.ToString();
    }
}