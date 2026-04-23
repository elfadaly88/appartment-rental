using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Application.Services;
using RentalsPlatform.Infrastructure.Data;

namespace RentalsPlatform.Infrastructure.Services;

public class PricingService : IPricingService
{
    private readonly ApplicationDbContext _dbContext;

    public PricingService(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<decimal> CalculateTotalAmountAsync(Guid propertyId, DateOnly checkIn, DateOnly checkOut)
    {
        if (checkIn >= checkOut)
            throw new ArgumentException("Check-out date must be after check-in date.");

        var property = await _dbContext.Properties
            .AsNoTracking()
            .Where(p => p.Id == propertyId)
            .Select(p => new { p.Id, p.BasePricePerNight })
            .FirstOrDefaultAsync();

        if (property is null)
            throw new InvalidOperationException("Property not found.");

        var rules = await _dbContext.PropertyPriceRules
            .AsNoTracking()
            .Where(r => r.PropertyId == propertyId && r.StartDate <= checkOut.AddDays(-1) && r.EndDate >= checkIn)
            .OrderBy(r => r.StartDate)
            .ToListAsync();

        decimal total = 0m;

        for (var day = checkIn; day < checkOut; day = day.AddDays(1))
        {
            var matchedRule = rules.FirstOrDefault(r => day >= r.StartDate && day <= r.EndDate);
            total += matchedRule?.CustomPricePerNight ?? property.BasePricePerNight;
        }

        // Calculate Extra Fees
        var fees = await _dbContext.PropertyFees
            .AsNoTracking()
            .Where(f => f.PropertyId == propertyId)
            .ToListAsync();

        var nights = checkOut.DayNumber - checkIn.DayNumber;
        decimal extraFeesTotal = 0m;

        foreach (var fee in fees)
        {
            if (fee.CalculationType == Domain.Enums.FeeCalculationType.PerNight)
            {
                extraFeesTotal += (fee.Amount * nights);
            }
            else
            {
                extraFeesTotal += fee.Amount;
            }
        }

        return total + extraFeesTotal;
    }
}
