using MediatR;

namespace RentalsPlatform.Application.Features.Bookings.Commands.CreateBooking;

public record CreateBookingCommand(
    Guid PropertyId,
    Guid GuestId,
    DateOnly CheckInDate,
    DateOnly CheckOutDate) : IRequest<Guid>; // هيرجع ID الحجز الجديد