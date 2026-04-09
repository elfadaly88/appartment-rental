using System.Globalization;
using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Application.DTOs.Analytics;
using RentalsPlatform.Application.Services;
using RentalsPlatform.Domain.Enums;
using RentalsPlatform.Infrastructure.Data;

namespace RentalsPlatform.Infrastructure.Services;

public class AnalyticsService : IAnalyticsService
{
    private readonly ApplicationDbContext _dbContext;

    public AnalyticsService(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<HostAnalyticsDashboardDto> GetHostDashboardStatsAsync(string hostId, int year)
    {
        if (!Guid.TryParse(hostId, out var hostGuid))
        {
            return new HostAnalyticsDashboardDto();
        }

        var yearStart = new DateOnly(year, 1, 1);
        var nextYearStart = new DateOnly(year + 1, 1, 1);

        var hostPropertyIdsQuery = _dbContext.Properties
            .AsNoTracking()
            .Where(p => p.HostId == hostGuid)
            .Select(p => p.Id);

        var monthlyRevenueRaw = await _dbContext.Bookings
            .AsNoTracking()
            .Where(b => b.Status == BookingStatus.Confirmed)
            .Where(b => hostPropertyIdsQuery.Contains(b.PropertyId))
            .Where(b => b.StartDate >= yearStart && b.StartDate < nextYearStart)
            .GroupBy(b => b.StartDate.Month)
            .Select(g => new
            {
                MonthNumber = g.Key,
                TotalRevenue = g.Sum(x => x.TotalPrice.Amount)
            })
            .OrderBy(x => x.MonthNumber)
            .ToListAsync();

        var monthlyRevenues = monthlyRevenueRaw
            .Select(x => new MonthlyRevenueDto(
                CultureInfo.InvariantCulture.DateTimeFormat.GetMonthName(x.MonthNumber),
                year,
                x.TotalRevenue))
            .ToList();

        var totalEarnings = monthlyRevenueRaw.Sum(x => x.TotalRevenue);

        var hostPropertiesCount = await _dbContext.Properties
            .AsNoTracking()
            .CountAsync(p => p.HostId == hostGuid);

        var totalAvailableDays = hostPropertiesCount * (DateTime.IsLeapYear(year) ? 366 : 365);

        var bookedDays = await _dbContext.Bookings
            .AsNoTracking()
            .Where(b => b.Status == BookingStatus.Confirmed)
            .Where(b => hostPropertyIdsQuery.Contains(b.PropertyId))
            .Where(b => b.StartDate < nextYearStart && b.EndDate > yearStart)
            .Select(b =>
                (b.EndDate.DayNumber > nextYearStart.DayNumber ? nextYearStart.DayNumber : b.EndDate.DayNumber) -
                (b.StartDate.DayNumber < yearStart.DayNumber ? yearStart.DayNumber : b.StartDate.DayNumber))
            .SumAsync();

        var occupancyRate = totalAvailableDays == 0
            ? 0d
            : (double)bookedDays / totalAvailableDays * 100d;

        return new HostAnalyticsDashboardDto
        {
            TotalEarnings = totalEarnings,
            OverallOccupancyRate = Math.Round(occupancyRate, 2),
            MonthlyRevenues = monthlyRevenues
        };
    }
}
