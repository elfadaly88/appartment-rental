namespace RentalsPlatform.Application.DTOs.Analytics;

public class HostAnalyticsDashboardDto
{
    public decimal TotalEarnings { get; init; }
    public double OverallOccupancyRate { get; init; }
    public List<MonthlyRevenueDto> MonthlyRevenues { get; init; } = [];
}
