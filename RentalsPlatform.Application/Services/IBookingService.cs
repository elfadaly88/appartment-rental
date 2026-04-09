using RentalsPlatform.Application.Common;
using RentalsPlatform.Application.DTOs.Bookings;

namespace RentalsPlatform.Application.Services;

public interface IBookingService
{
    Task<Guid> CreateGuestBookingAsync(Guid propertyId, Guid guestId, DateOnly checkInDate, DateOnly checkOutDate, CancellationToken cancellationToken = default);
    Task BlockDatesAsync(BlockDatesDto dto, CancellationToken cancellationToken = default);
    Task<IEnumerable<HostBookingDto>> GetHostBookingsAsync(string hostId);
    Task<Result> ApproveBookingAsync(Guid bookingId, string hostId);
    Task<Result> RejectBookingAsync(Guid bookingId, string hostId);
}
