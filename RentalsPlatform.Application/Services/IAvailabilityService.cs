using RentalsPlatform.Application.DTOs.Calendar;

namespace RentalsPlatform.Application.Services;

public interface IAvailabilityService
{
    Task<bool> IsPeriodAvailableAsync(Guid propertyId, DateOnly start, DateOnly end);
    Task<IReadOnlyCollection<DateOnly>> GetTakenDatesAsync(Guid propertyId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns typed calendar ranges (booking, blocked, seasonal) for a given property and date window.
    /// Used by both the host calendar UI and the guest booking widget.
    /// </summary>
    Task<IReadOnlyCollection<CalendarEntryDto>> GetCalendarEntriesAsync(
        Guid propertyId, DateOnly startDate, DateOnly endDate,
        CancellationToken cancellationToken = default);
}
