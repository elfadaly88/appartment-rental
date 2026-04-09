using MediatR;
using RentalsPlatform.Application.Services;

namespace RentalsPlatform.Application.Features.Bookings.Commands.CreateBooking;

public class CreateBookingCommandHandler : IRequestHandler<CreateBookingCommand, Guid>
{
    private readonly IBookingService _bookingService;

    public CreateBookingCommandHandler(IBookingService bookingService)
    {
        _bookingService = bookingService;
    }

    public async Task<Guid> Handle(CreateBookingCommand request, CancellationToken cancellationToken)
    {
        return await _bookingService.CreateGuestBookingAsync(
            request.PropertyId,
            request.GuestId,
            request.CheckInDate,
            request.CheckOutDate,
            cancellationToken);
    }
}