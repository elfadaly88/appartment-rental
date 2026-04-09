using RentalsPlatform.Application.DTOs.Lookups;

namespace RentalsPlatform.Infrastructure.Services;

public interface ILookupService
{
    Task<IEnumerable<GovernorateDto>> GetEgyptGovernoratesWithCitiesAsync();
}
