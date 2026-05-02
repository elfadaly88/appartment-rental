using RentalsPlatform.Application.DTOs.Calendar;

namespace RentalsPlatform.Application.Services;

public interface IHostCalendarService
{
    /// <summary>Blocks a date range in the UnavailableDates table. Returns the new entry ID.</summary>
    Task<Guid> BlockDatesAsync(BlockDto dto, CancellationToken cancellationToken = default);

    Task UnblockDatesAsync(Guid id, CancellationToken cancellationToken = default);
}
