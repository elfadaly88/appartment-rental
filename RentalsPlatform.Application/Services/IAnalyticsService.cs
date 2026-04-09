using RentalsPlatform.Application.DTOs.Analytics;

namespace RentalsPlatform.Application.Services;

public interface IAnalyticsService
{
    Task<HostAnalyticsDashboardDto> GetHostDashboardStatsAsync(string hostId, int year);
}
