using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Application.DTOs.Calendar;
using RentalsPlatform.Application.Services;
using RentalsPlatform.Infrastructure.Data;

namespace RentalsPlatform.Infrastructure.Services;

public class PricingService : IPricingService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IAvailabilityService _availabilityService;

    public PricingService(ApplicationDbContext dbContext, IAvailabilityService availabilityService)
    {
        _dbContext = dbContext;
        _availabilityService = availabilityService;
    }

    // ── CalculateTotalAmountAsync ────────────────────────────────────────

    public async Task<decimal> CalculateTotalAmountAsync(Guid propertyId, DateOnly checkIn, DateOnly checkOut)
    {
        var result = await CalculatePricingAsync(propertyId, checkIn, checkOut);
        return result.FinalAmount;
    }

    // ── CalculatePricingAsync ────────────────────────────────────────────

    public async Task<PricingResult> CalculatePricingAsync(Guid propertyId, DateOnly checkIn, DateOnly checkOut)
    {
        if (checkIn >= checkOut)
            throw new ArgumentException("Check-out date must be after check-in date.");

        var property = await _dbContext.Properties
            .AsNoTracking()
            .Where(p => p.Id == propertyId)
            .Select(p => new { p.Id, p.BasePricePerNight, Currency = p.PricePerNight.Currency })
            .FirstOrDefaultAsync();

        if (property is null)
            throw new InvalidOperationException("Property not found.");

        var nights = checkOut.DayNumber - checkIn.DayNumber;

        var rules = await _dbContext.PropertyPriceRules
            .AsNoTracking()
            .Where(r => r.PropertyId == propertyId && r.StartDate <= checkOut.AddDays(-1) && r.EndDate >= checkIn)
            .OrderBy(r => r.StartDate)
            .ToListAsync();

        decimal nightsSubTotal = 0m;
        for (var day = checkIn; day < checkOut; day = day.AddDays(1))
        {
            var matchedRule = rules.FirstOrDefault(r => day >= r.StartDate && day <= r.EndDate);
            nightsSubTotal += matchedRule?.CustomPricePerNight ?? property.BasePricePerNight;
        }

        // Extra Fees
        var fees = await _dbContext.PropertyFees
            .AsNoTracking()
            .Where(f => f.PropertyId == propertyId)
            .ToListAsync();

        decimal feesTotal = 0m;
        foreach (var fee in fees)
        {
            feesTotal += fee.CalculationType == Domain.Enums.FeeCalculationType.PerNight
                ? fee.Amount * nights
                : fee.Amount;
        }

        var subTotal = nightsSubTotal + feesTotal;

        // ── Length-of-stay discount: pick the best qualifying rule ───────
        var discount = await _dbContext.HostDiscounts
            .AsNoTracking()
            .Where(d => d.PropertyId == propertyId && d.IsActive && d.MinNights <= nights)
            .OrderByDescending(d => d.MinNights)   // prefer the most specific (longest) rule
            .FirstOrDefaultAsync();

        decimal discountAmount = 0m;
        string? discountLabel = null;

        if (discount is not null)
        {
            discountAmount = Math.Round(nightsSubTotal * (discount.DiscountPercent / 100m), 2);
    discountLabel = discount.Label;
        }

        return new PricingResult(
            SubTotal: subTotal,
    DiscountAmount: discountAmount,
    DiscountLabel: discountLabel,
    FinalAmount: (nightsSubTotal - discountAmount) + feesTotal,
    Currency: property.Currency);
    }

    // ── GetBreakdownAsync ────────────────────────────────────────────────

    /// <inheritdoc/>
    public async Task<BookingQuoteDto> GetBreakdownAsync(
        Guid propertyId, DateOnly checkIn, DateOnly checkOut,
        CancellationToken cancellationToken = default)
    {
        static BookingQuoteDto Unavailable(string reason, int nights = 0) =>
            new(false, reason, nights, 0, 0, [], 0, 0, 0, "USD", 0, null);

        if (checkIn >= checkOut)
            return Unavailable("Check-out date must be after check-in date.");

        var totalNights = checkOut.DayNumber - checkIn.DayNumber;

        // Priority 1: availability (blocked > existing bookings)
        var isAvailable = await _availabilityService.IsPeriodAvailableAsync(propertyId, checkIn, checkOut);
        if (!isAvailable)
            return Unavailable(
                "Sorry, some dates in your selection are unavailable. Please choose different dates.",
                totalNights);

        var property = await _dbContext.Properties
            .AsNoTracking()
            .Where(p => p.Id == propertyId)
            .Select(p => new { p.BasePricePerNight, Currency = p.PricePerNight.Currency })
            .FirstOrDefaultAsync(cancellationToken);

        if (property is null)
            return Unavailable("Property not found.");

        // Priority 2: seasonal rules override base price per night
        var rules = await _dbContext.PropertyPriceRules
            .AsNoTracking()
            .Where(r => r.PropertyId == propertyId &&
                        r.StartDate <= checkOut.AddDays(-1) &&
                        r.EndDate >= checkIn)
            .OrderBy(r => r.StartDate)
            .ToListAsync(cancellationToken);

        int regularNights = 0;
        decimal regularTotal = 0m;
        var seasonalMap = new Dictionary<string, (int nights, decimal rate, decimal total)>(StringComparer.Ordinal);

        for (var day = checkIn; day < checkOut; day = day.AddDays(1))
        {
            var rule = rules.FirstOrDefault(r => day >= r.StartDate && day <= r.EndDate);
            if (rule is null)
            {
                regularNights++;
                regularTotal += property.BasePricePerNight;
            }
            else
            {
                var key = string.IsNullOrWhiteSpace(rule.Label)
                    ? $"Season ({rule.StartDate:MMM d} – {rule.EndDate:MMM d})"
                    : rule.Label;

                if (!seasonalMap.TryGetValue(key, out var existing))
                    existing = (0, rule.CustomPricePerNight, 0m);

                seasonalMap[key] = (existing.nights + 1, existing.rate, existing.total + rule.CustomPricePerNight);
            }
        }

        var seasonalGroups = seasonalMap
            .Select(kv => new SeasonalGroupDto(kv.Key, kv.Value.nights, kv.Value.rate, kv.Value.total))
            .ToList();

        var subTotal = regularTotal + seasonalGroups.Sum(g => g.GroupTotal);

        var fees = await _dbContext.PropertyFees
            .AsNoTracking()
            .Where(f => f.PropertyId == propertyId)
            .ToListAsync(cancellationToken);

        decimal feesTotal = 0m;
        foreach (var fee in fees)
        {
            feesTotal += fee.CalculationType == Domain.Enums.FeeCalculationType.PerNight
                ? fee.Amount * totalNights
                : fee.Amount;
        }

        var totalBeforeDiscount = subTotal + feesTotal;

        // ── Length-of-stay discount ──────────────────────────────────────
        var discount = await _dbContext.HostDiscounts
            .AsNoTracking()
            .Where(d => d.PropertyId == propertyId && d.IsActive && d.MinNights <= totalNights)
            .OrderByDescending(d => d.MinNights)
            .FirstOrDefaultAsync(cancellationToken);

        decimal discountAmount = 0m;
        string? discountLabel = null;

        if (discount is not null)
        {
            discountAmount = Math.Round(subTotal * (discount.DiscountPercent / 100m), 2);
    discountLabel = discount.Label;
        }

        return new BookingQuoteDto(
           IsAvailable: true,
    UnavailabilityReason: null,
    TotalNights: totalNights,
    RegularNights: regularNights,
    RegularRatePerNight: property.BasePricePerNight,
    SeasonalGroups: seasonalGroups,
    SubTotal: subTotal,
    FeesTotal: feesTotal,
    TotalAmount: (subTotal - discountAmount) + feesTotal,
    Currency: property.Currency,
    DiscountAmount: discountAmount,
    DiscountLabel: discountLabel);
    }
}
