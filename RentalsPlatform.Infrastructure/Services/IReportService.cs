using RentalsPlatform.Application.DTOs.Analytics;

namespace RentalsPlatform.Infrastructure.Services;

public interface IReportService
{
    Task<byte[]> GenerateExcelReportAsync(HostAnalyticsDashboardDto data);
    Task<byte[]> GeneratePdfReportAsync(HostAnalyticsDashboardDto data);
}
