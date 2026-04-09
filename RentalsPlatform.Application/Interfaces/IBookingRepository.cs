using RentalsPlatform.Domain.Entities;

namespace RentalsPlatform.Application.Interfaces;

public interface IBookingRepository
{
    Task AddAsync(Booking booking, CancellationToken cancellationToken);

    // دي الدالة اللي هتدور لو في أي حجز (سواء Pending أو Confirmed) بيتقاطع مع التواريخ المطلوبة
    Task<bool> HasOverlappingBookingAsync(
        Guid propertyId,
        DateOnly start,
        DateOnly end,
        CancellationToken cancellationToken,
        Guid? excludedBookingId = null);
}