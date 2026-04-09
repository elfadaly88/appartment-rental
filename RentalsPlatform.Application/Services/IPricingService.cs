namespace RentalsPlatform.Application.Services;

public interface IPricingService
{
    Task<decimal> CalculateTotalAmountAsync(Guid propertyId, DateOnly checkIn, DateOnly checkOut);
}
