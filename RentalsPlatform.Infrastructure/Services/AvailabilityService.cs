using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Application.Services;
using RentalsPlatform.Domain.Enums;
using RentalsPlatform.Infrastructure.Data;

namespace RentalsPlatform.Infrastructure.Services;

public class AvailabilityService : IAvailabilityService
{
    private readonly ApplicationDbContext _dbContext;

    public AvailabilityService(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> IsPeriodAvailableAsync(Guid propertyId, DateOnly start, DateOnly end)
    {
        if (start >= end)
            return false;

        var hasConfirmedBooking = await _dbContext.Bookings
            .AsNoTracking()
            .AnyAsync(b =>
                b.PropertyId == propertyId &&
                b.Status == BookingStatus.Confirmed &&
                start < b.EndDate &&
                end > b.StartDate);

        if (hasConfirmedBooking)
            return false;

        var hasBlockedDate = await _dbContext.UnavailableDates
            .AsNoTracking()
            .AnyAsync(u =>
                u.PropertyId == propertyId &&
                start < u.EndDate &&
                end > u.StartDate);

        return !hasBlockedDate;
    }

    public async Task<IReadOnlyCollection<DateOnly>> GetTakenDatesAsync(Guid propertyId, CancellationToken cancellationToken = default)
    {
        var confirmedRanges = await _dbContext.Bookings
            .AsNoTracking()
            .Where(b => b.PropertyId == propertyId && b.Status == BookingStatus.Confirmed)
            .Select(b => new { b.StartDate, b.EndDate })
            .ToListAsync(cancellationToken);

        var blockedRanges = await _dbContext.UnavailableDates
            .AsNoTracking()
            .Where(u => u.PropertyId == propertyId)
            .Select(u => new { u.StartDate, u.EndDate })
            .ToListAsync(cancellationToken);

        var takenDates = new HashSet<DateOnly>();

        foreach (var range in confirmedRanges)
        {
            for (var date = range.StartDate; date < range.EndDate; date = date.AddDays(1))
            {
                takenDates.Add(date);
            }
        }

        foreach (var range in blockedRanges)
        {
            for (var date = range.StartDate; date < range.EndDate; date = date.AddDays(1))
            {
                takenDates.Add(date);
            }
        }

        return takenDates
            .OrderBy(d => d)
            .ToArray();
    }
}
