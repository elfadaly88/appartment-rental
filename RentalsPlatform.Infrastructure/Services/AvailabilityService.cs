using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Application.DTOs.Calendar;
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

    // ── GetCalendarEntriesAsync ───────────────────────────────────────────

    /// <inheritdoc/>
    public async Task<IReadOnlyCollection<CalendarEntryDto>> GetCalendarEntriesAsync(
        Guid propertyId, DateOnly startDate, DateOnly endDate,
        CancellationToken cancellationToken = default)
    {
        var entries = new List<CalendarEntryDto>();

        // ── 1. Guest bookings and host-blocked bookings ─────────────────
        var bookings = await _dbContext.Bookings
            .AsNoTracking()
            .Where(b =>
                b.PropertyId == propertyId &&
                (b.Status == BookingStatus.Confirmed ||
                 b.Status == BookingStatus.Approved ||
                 b.Status == BookingStatus.HostBlocked ||
                 b.Status == BookingStatus.Completed) &&
                b.StartDate < endDate &&
                b.EndDate > startDate)
            .Select(b => new
            {
                b.Id,
                b.StartDate,
                b.EndDate,
                b.Status,
                b.GuestId,
                b.Reason,
            })
            .ToListAsync(cancellationToken);

        // Fetch guest names in a single query
        var guestIds = bookings
            .Where(b => b.Status != BookingStatus.HostBlocked)
            .Select(b => b.GuestId.ToString())
            .Distinct()
            .ToList();

        var guestNames = new Dictionary<string, string>();
        if (guestIds.Count > 0)
        {
            guestNames = await _dbContext.Users
                .AsNoTracking()
                .Where(u => guestIds.Contains(u.Id))
                .Select(u => new { u.Id, Name = (u.FirstName + " " + u.LastName).Trim() })
                .ToDictionaryAsync(u => u.Id, u => u.Name, cancellationToken);
        }

        foreach (var b in bookings)
        {
            var isHostBlocked = b.Status == BookingStatus.HostBlocked;
            entries.Add(new CalendarEntryDto(
                Id: b.Id.ToString(),
                Type: isHostBlocked ? "blocked" : "booking",
                StartDate: b.StartDate.ToString("yyyy-MM-dd"),
                EndDate: b.EndDate.ToString("yyyy-MM-dd"),
                Deletable: false, // HostBlocked bookings require cancellation flow
                GuestName: isHostBlocked ? null : guestNames.GetValueOrDefault(b.GuestId.ToString()),
                Note: isHostBlocked ? b.Reason : null));
        }

        // ── 2. UnavailableDate entries (host calendar blocks) ───────────
        var unavailable = await _dbContext.UnavailableDates
            .AsNoTracking()
            .Where(u =>
                u.PropertyId == propertyId &&
                u.StartDate < endDate &&
                u.EndDate > startDate)
            .ToListAsync(cancellationToken);

        foreach (var u in unavailable)
        {
            entries.Add(new CalendarEntryDto(
                Id: u.Id.ToString(),
                Type: "blocked",
                StartDate: u.StartDate.ToString("yyyy-MM-dd"),
                EndDate: u.EndDate.ToString("yyyy-MM-dd"),
                Deletable: true, // Host can remove these via the calendar DELETE endpoint
                Note: u.Reason));
        }

        // ── 3. Seasonal price rules ─────────────────────────────────────
        var priceRules = await _dbContext.PropertyPriceRules
            .AsNoTracking()
            .Where(r =>
                r.PropertyId == propertyId &&
                r.StartDate < endDate &&
                r.EndDate > startDate)
            .ToListAsync(cancellationToken);

        foreach (var r in priceRules)
        {
            entries.Add(new CalendarEntryDto(
                Id: r.Id.ToString(),
                Type: "seasonal",
                StartDate: r.StartDate.ToString("yyyy-MM-dd"),
                EndDate: r.EndDate.ToString("yyyy-MM-dd"),
                Deletable: false,
                Label: r.Label,
                CustomPrice: r.CustomPricePerNight));
        }

        return entries
            .OrderBy(e => e.StartDate)
            .ThenBy(e => e.Type) // blocked first within same date
            .ToArray();
    }

    public async Task<bool> IsPeriodAvailableAsync(Guid propertyId, DateOnly start, DateOnly end)
    {
        if (start >= end)
            return false;

        var hasBlockingBooking = await _dbContext.Bookings
            .AsNoTracking()
            .AnyAsync(b =>
                b.PropertyId == propertyId &&
                (b.Status == BookingStatus.Confirmed ||
                 b.Status == BookingStatus.Approved ||
                 b.Status == BookingStatus.HostBlocked ||
                 b.Status == BookingStatus.Completed) &&
                start < b.EndDate &&
                end > b.StartDate);

        if (hasBlockingBooking)
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
        var blockingRanges = await _dbContext.Bookings
            .AsNoTracking()
            .Where(b => b.PropertyId == propertyId &&
                       (b.Status == BookingStatus.Confirmed ||
                        b.Status == BookingStatus.Approved ||
                        b.Status == BookingStatus.HostBlocked ||
                        b.Status == BookingStatus.Completed))
            .Select(b => new { b.StartDate, b.EndDate })
            .ToListAsync(cancellationToken);

        var blockedRanges = await _dbContext.UnavailableDates
            .AsNoTracking()
            .Where(u => u.PropertyId == propertyId)
            .Select(u => new { u.StartDate, u.EndDate })
            .ToListAsync(cancellationToken);

        var takenDates = new HashSet<DateOnly>();

        foreach (var range in blockingRanges)
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
