namespace RentalsPlatform.Application.DTOs.Admin;

public class MasterDashboardStatsDto
{
    public decimal TotalPlatformRevenue { get; init; }
    public int ActiveBookingsCount { get; init; }
    public double MonthlyGrowthPercentage { get; init; }
    public List<MonthlyRevenueTrendDto> MonthlyRevenueTrend { get; init; } = [];
}
