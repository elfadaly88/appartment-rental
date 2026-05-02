using RentalsPlatform.Application.DTOs.Calendar;

namespace RentalsPlatform.Application.Services;

/// <summary>Full pricing result including any length-of-stay discount applied.</summary>
public sealed record PricingResult(
    decimal SubTotal,
    decimal DiscountAmount,
    string? DiscountLabel,
    decimal FinalAmount,
    string Currency);

public interface IPricingService
{
    Task<decimal> CalculateTotalAmountAsync(Guid propertyId, DateOnly checkIn, DateOnly checkOut);

    /// <summary>
    /// Calculates the full pricing breakdown including any applicable length-of-stay discounts.
    /// </summary>
    Task<PricingResult> CalculatePricingAsync(Guid propertyId, DateOnly checkIn, DateOnly checkOut);

    /// <summary>
    /// Returns a full availability check + night-by-night price breakdown for a guest booking quote.
    /// Checks blocked dates and existing bookings before computing prices.
    /// </summary>
    Task<BookingQuoteDto> GetBreakdownAsync(
        Guid propertyId, DateOnly checkIn, DateOnly checkOut,
        CancellationToken cancellationToken = default);
}
