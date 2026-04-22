namespace RentalsPlatform.Application.DTOs.Public;

/// <summary>
/// Public landing-page statistics returned without authentication.
/// </summary>
public sealed class LandingStatsDto
{
    public int TotalClients        { get; init; }
    public int LuxuryUnits         { get; init; }
    public int AnnualTransactions  { get; init; }
    public string CurrentYear      { get; init; } = string.Empty;
}
