namespace RentalsPlatform.Application.Services;

public interface IAvailabilityService
{
    Task<bool> IsPeriodAvailableAsync(Guid propertyId, DateOnly start, DateOnly end);
    Task<IReadOnlyCollection<DateOnly>> GetTakenDatesAsync(Guid propertyId, CancellationToken cancellationToken = default);
}
