using RentalsPlatform.Application.DTOs.Calendar;

namespace RentalsPlatform.Application.Services;

public interface IHostCalendarService
{
    Task BlockDatesAsync(BlockDto dto, CancellationToken cancellationToken = default);
    Task UnblockDatesAsync(Guid id, CancellationToken cancellationToken = default);
}
