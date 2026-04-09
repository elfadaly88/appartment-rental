using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using RentalsPlatform.Application.DTOs.Lookups;
using RentalsPlatform.Infrastructure.Data;

namespace RentalsPlatform.Infrastructure.Services;

public class LookupService : ILookupService
{
    private const string EgyptLocationsCacheKey = "lookups:egypt:governorates:cities";
    private static readonly TimeSpan CacheDuration = TimeSpan.FromDays(30);

    private readonly IMemoryCache _memoryCache;
    private readonly ApplicationDbContext _dbContext;

    public LookupService(IMemoryCache memoryCache, ApplicationDbContext dbContext)
    {
        _memoryCache = memoryCache;
        _dbContext = dbContext;
    }

    public async Task<IEnumerable<GovernorateDto>> GetEgyptGovernoratesWithCitiesAsync()
    {
        if (_memoryCache.TryGetValue(EgyptLocationsCacheKey, out IReadOnlyCollection<GovernorateDto>? cached)
            && cached is not null)
        {
            return cached;
        }

        var governorates = await _dbContext.Governorates
            .AsNoTracking()
            .Where(g => g.CountryId == 1)
            .Include(g => g.Cities)
            .OrderBy(g => g.NameEn)
            .Select(g => new GovernorateDto(
                g.Id,
                g.NameAr,
                g.NameEn,
                g.Cities
                    .OrderBy(c => c.NameEn)
                    .Select(c => new CityDto(c.Id, c.NameAr, c.NameEn))
                    .ToList()))
            .ToListAsync();

        _memoryCache.Set(EgyptLocationsCacheKey, governorates, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = CacheDuration
        });

        return governorates;
    }
}
