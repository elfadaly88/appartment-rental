using RentalsPlatform.Application.Common;
using RentalsPlatform.Application.DTOs.Bookings;

namespace RentalsPlatform.Application.Services;

public interface IBookingService
{
    Task<Guid> CreateGuestBookingAsync(Guid propertyId, Guid guestId, int guestCount, DateOnly checkInDate, DateOnly checkOutDate, CancellationToken cancellationToken = default);
    Task<decimal> CalculateGuestBookingTotalAsync(Guid propertyId, DateOnly checkInDate, DateOnly checkOutDate, CancellationToken cancellationToken = default);
    Task BlockDatesAsync(BlockDatesDto dto, CancellationToken cancellationToken = default);
    Task<IEnumerable<HostBookingDto>> GetHostBookingsAsync(string hostId);
    Task<IEnumerable<HostPipelineBookingDto>> GetHostPipelineAsync(string hostId);
    Task<Result> ApproveBookingAsync(Guid bookingId, string hostId);
    Task<Result> RejectBookingAsync(Guid bookingId, string hostId, string reason);
    Task<Result> ConfirmCheckInAsync(Guid bookingId, string hostId);
    Task<IEnumerable<GuestBookingDto>> GetGuestBookingsAsync(Guid guestId, CancellationToken cancellationToken = default);
    Task<Result> CancelGuestBookingAsync(Guid bookingId, Guid guestId);
    Task ExpireApprovedBookingsAsync();
}

