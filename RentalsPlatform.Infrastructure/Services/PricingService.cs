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
            .Select(p => new { p.Id, p.BasePricePerNight, p.ServiceFeePercentage, p.TaxPercentage })
            .FirstOrDefaultAsync();

        if (property is null)
            throw new InvalidOperationException("Property not found.");

        var rules = await _dbContext.PropertyPriceRules
            .AsNoTracking()
            .Where(r => r.PropertyId == propertyId && r.StartDate <= checkOut.AddDays(-1) && r.EndDate >= checkIn)
            .OrderBy(r => r.StartDate)
            .ToListAsync();

        decimal subtotal = 0m;

        for (var day = checkIn; day < checkOut; day = day.AddDays(1))
        {
            var matchedRule = rules.FirstOrDefault(r => day >= r.StartDate && day <= r.EndDate);
            subtotal += matchedRule?.CustomPricePerNight ?? property.BasePricePerNight;
        }

        var serviceFeeRate = property.ServiceFeePercentage ?? 0m;
        var taxRate = property.TaxPercentage ?? 0m;

        var serviceFee = serviceFeeRate > 0m
            ? subtotal * (serviceFeeRate / 100m)
            : 0m;

        var taxBase = subtotal + serviceFee;
        var tax = taxRate > 0m
            ? taxBase * (taxRate / 100m)
            : 0m;

        return subtotal + serviceFee + tax;
    }
}
