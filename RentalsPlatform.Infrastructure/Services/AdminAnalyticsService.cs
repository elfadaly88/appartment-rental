using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using RentalsPlatform.Application.DTOs.Admin;
using RentalsPlatform.Application.Services;
using RentalsPlatform.Domain.Enums;
using RentalsPlatform.Infrastructure.Data;

namespace RentalsPlatform.Infrastructure.Services;

public class AdminAnalyticsService : IAdminAnalyticsService
{
    private const string CacheKey = "master-dashboard-stats";
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(15);

    private readonly ApplicationDbContext _dbContext;
    private readonly IMemoryCache _memoryCache;

    public AdminAnalyticsService(ApplicationDbContext dbContext, IMemoryCache memoryCache)
    {
        _dbContext = dbContext;
        _memoryCache = memoryCache;
    }

    public async Task<MasterDashboardStatsDto> GetMasterStatsAsync()
    {
        if (_memoryCache.TryGetValue(CacheKey, out MasterDashboardStatsDto? cached) && cached is not null)
            return cached;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var now = DateTime.UtcNow;
        var currentMonthStart = new DateOnly(now.Year, now.Month, 1);
        var nextMonthStart = currentMonthStart.AddMonths(1);
        var previousMonthStart = currentMonthStart.AddMonths(-1);
        var trendStart = currentMonthStart.AddMonths(-11);

        var confirmedBookings = _dbContext.Bookings
            .AsNoTracking()
            .Where(b => b.Status == BookingStatus.Confirmed);

        var totalConfirmedRevenue = await confirmedBookings
            .SumAsync(b => (decimal?)b.TotalPrice.Amount) ?? 0m;

        var totalPlatformRevenue = Math.Round(totalConfirmedRevenue * 0.10m, 2);

        var activeBookingsCount = await confirmedBookings
            .CountAsync(b => b.StartDate <= today && b.EndDate >= today);

        var currentMonthRevenue = await confirmedBookings
            .Where(b => b.StartDate >= currentMonthStart && b.StartDate < nextMonthStart)
            .SumAsync(b => (decimal?)b.TotalPrice.Amount) ?? 0m;

        var lastMonthRevenue = await confirmedBookings
            .Where(b => b.StartDate >= previousMonthStart && b.StartDate < currentMonthStart)
            .SumAsync(b => (decimal?)b.TotalPrice.Amount) ?? 0m;

        var monthlyGrowthPercentage = lastMonthRevenue == 0m
            ? (currentMonthRevenue == 0m ? 0d : 100d)
            : Math.Round((double)((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100m), 2);

        var trendRaw = await confirmedBookings
            .Where(b => b.StartDate >= trendStart && b.StartDate < nextMonthStart)
            .GroupBy(b => new { b.StartDate.Year, b.StartDate.Month })
            .Select(g => new
            {
                g.Key.Year,
                g.Key.Month,
                Revenue = g.Sum(x => x.TotalPrice.Amount)
            })
            .OrderBy(x => x.Year)
            .ThenBy(x => x.Month)
            .ToListAsync();

        var monthlyRevenueTrend = trendRaw
            .Select(x => new MonthlyRevenueTrendDto(
                Month: $"{CultureInfo.InvariantCulture.DateTimeFormat.GetAbbreviatedMonthName(x.Month)} {x.Year}",
                Revenue: x.Revenue))
            .ToList();

        var result = new MasterDashboardStatsDto
        {
            TotalPlatformRevenue = totalPlatformRevenue,
            ActiveBookingsCount = activeBookingsCount,
            MonthlyGrowthPercentage = monthlyGrowthPercentage,
            MonthlyRevenueTrend = monthlyRevenueTrend
        };

        _memoryCache.Set(CacheKey, result, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = CacheDuration
        });

        return result;
    }
}
