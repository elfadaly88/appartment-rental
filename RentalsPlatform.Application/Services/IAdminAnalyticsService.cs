using RentalsPlatform.Application.DTOs.Admin;

namespace RentalsPlatform.Application.Services;

public interface IAdminAnalyticsService
{
    Task<MasterDashboardStatsDto> GetMasterStatsAsync();
}
