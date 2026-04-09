using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Application.Interfaces;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Domain.Enums;
using RentalsPlatform.Infrastructure.Data;

public class BookingRepository : IBookingRepository
{
    private readonly ApplicationDbContext _context;
    public BookingRepository(ApplicationDbContext context) => _context = context;

    public async Task AddAsync(Booking booking, CancellationToken cancellationToken)
    {
        await _context.Bookings.AddAsync(booking, cancellationToken);
    }

    public async Task<bool> HasOverlappingBookingAsync(
        Guid propertyId,
        DateOnly checkInDate,
        DateOnly checkOutDate,
        CancellationToken cancellationToken,
        Guid? excludedBookingId = null)
    {
        return await _context.Bookings
            .AnyAsync(b =>
                b.PropertyId == propertyId &&
                b.Status != BookingStatus.Cancelled &&
                (excludedBookingId == null || b.Id != excludedBookingId.Value) &&
                b.StartDate < checkOutDate &&
                b.EndDate > checkInDate,
            cancellationToken);
    }
}