using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Application.Common;
using RentalsPlatform.Application.DTOs.Bookings;
using RentalsPlatform.Application.DTOs.Notifications;
using RentalsPlatform.Application.Interfaces;
using RentalsPlatform.Application.Services;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Domain.Enums;
using RentalsPlatform.Domain.ValueObjects;
using RentalsPlatform.Infrastructure.Data;
using RentalsPlatform.Infrastructure.Hubs;

namespace RentalsPlatform.Infrastructure.Services;

public class BookingService : IBookingService
{
    private readonly IBookingRepository _bookingRepository;
    private readonly IPropertyRepository _propertyRepository;
    private readonly INotificationService _notificationService;
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly ApplicationDbContext _dbContext;

    public BookingService(
        IBookingRepository bookingRepository,
        IPropertyRepository propertyRepository,
        INotificationService notificationService,
        IHubContext<NotificationHub> hubContext,
        ApplicationDbContext dbContext)
    {
        _bookingRepository = bookingRepository;
        _propertyRepository = propertyRepository;
        _notificationService = notificationService;
        _hubContext = hubContext;
        _dbContext = dbContext;
    }

    public async Task<Guid> CreateGuestBookingAsync(Guid propertyId, Guid guestId, DateOnly checkInDate, DateOnly checkOutDate, CancellationToken cancellationToken = default)
    {
        var property = await _propertyRepository.GetByIdAsync(propertyId, cancellationToken);
        if (property is null)
            throw new InvalidOperationException("Property not found.");

        var host = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == property.HostId.ToString(), cancellationToken);

        if (host is null || string.IsNullOrWhiteSpace(host.PaymobSubMerchantId))
            throw new InvalidOperationException("This property is temporarily unavailable for booking until host payout setup is completed.");

        var isOverlap = await _bookingRepository.HasOverlappingBookingAsync(
            propertyId,
            checkInDate,
            checkOutDate,
            cancellationToken);

        if (isOverlap)
            throw new InvalidOperationException("Sorry, these dates are already booked.");

        var duration = new DateRange(checkInDate, checkOutDate);
        var booking = new Booking(property.Id, guestId, duration, property.PricePerNight);

        property.MarkAsBooked();
        await _bookingRepository.AddAsync(booking, cancellationToken);
        await _propertyRepository.SaveChangesAsync(cancellationToken);

        var propertyName = string.IsNullOrWhiteSpace(property.Name.En) ? property.Name.Ar : property.Name.En;
        var guest = await _dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == guestId.ToString())
            .Select(u => new
            {
                u.FirstName,
                u.LastName,
                u.Email
            })
            .FirstOrDefaultAsync(cancellationToken);

        var guestName = guest is null
            ? "Guest"
            : string.IsNullOrWhiteSpace($"{guest.FirstName} {guest.LastName}".Trim())
                ? (guest.Email ?? "Guest")
                : $"{guest.FirstName} {guest.LastName}".Trim();

        var message = $"New booking request from {guestName} for {propertyName}";
        var targetLink = $"/host/bookings/{booking.Id}";

        var notification = new Notification(
            property.HostId.ToString(),
            "New Booking Request",
            message,
            targetLink);

        await _notificationService.CreateNotificationAsync(notification);

        var notificationPayload = new BookingNotificationPayload(
            booking.Id,
            propertyName,
            guestName,
            message);

        await _hubContext.Clients.User(property.HostId.ToString())
            .SendAsync("ReceiveNotification", notificationPayload, cancellationToken);

        return booking.Id;
    }

    public async Task BlockDatesAsync(BlockDatesDto dto, CancellationToken cancellationToken = default)
    {
        var property = await _propertyRepository.GetByIdAsync(dto.PropertyId, cancellationToken);
        if (property is null)
            throw new InvalidOperationException("Property not found.");

        var hasOverlap = await _bookingRepository.HasOverlappingBookingAsync(
            dto.PropertyId,
            dto.StartDate,
            dto.EndDate,
            cancellationToken);

        if (hasOverlap)
            throw new InvalidOperationException("Cannot block these dates because they overlap with an existing reservation.");

        var blockedBooking = Booking.CreateHostBlock(dto.PropertyId, dto.StartDate, dto.EndDate, dto.Reason);

        await _bookingRepository.AddAsync(blockedBooking, cancellationToken);
        await _propertyRepository.SaveChangesAsync(cancellationToken);
    }

    public async Task<IEnumerable<HostBookingDto>> GetHostBookingsAsync(string hostId)
    {
        if (!Guid.TryParse(hostId, out var hostGuid))
            return Enumerable.Empty<HostBookingDto>();

        var hostBookings = await (
            from booking in _dbContext.Bookings.AsNoTracking()
            join property in _dbContext.Properties.AsNoTracking() on booking.PropertyId equals property.Id
            where property.HostId == hostGuid
            orderby booking.StartDate descending
            select new
            {
                booking.Id,
                PropertyName = property.Name.En,
                booking.GuestId,
                booking.StartDate,
                booking.EndDate,
                TotalPrice = booking.TotalPrice.Amount,
                booking.Status
            })
            .ToListAsync();

        var guestIds = hostBookings
            .Select(x => x.GuestId.ToString())
            .Distinct()
            .ToList();

        var guests = await _dbContext.Users
            .AsNoTracking()
            .Where(u => guestIds.Contains(u.Id))
            .Select(u => new
            {
                u.Id,
                FullName = string.Join(" ", new[] { u.FirstName, u.LastName }.Where(v => !string.IsNullOrWhiteSpace(v))).Trim()
            })
            .ToDictionaryAsync(x => x.Id, x => string.IsNullOrWhiteSpace(x.FullName) ? "Unknown Guest" : x.FullName);

        return hostBookings.Select(x =>
        {
            var guestId = x.GuestId.ToString();
            var guestName = guests.TryGetValue(guestId, out var name) ? name : "Unknown Guest";

            return new HostBookingDto(
                x.Id,
                x.PropertyName,
                guestName,
                x.StartDate,
                x.EndDate,
                x.TotalPrice,
                x.Status);
        });
    }

    public async Task<Result> ApproveBookingAsync(Guid bookingId, string hostId)
    {
        if (!Guid.TryParse(hostId, out var hostGuid))
            return Result.Failure("Invalid host id.");

        var bookingData = await (
            from booking in _dbContext.Bookings
            join property in _dbContext.Properties on booking.PropertyId equals property.Id
            where booking.Id == bookingId && property.HostId == hostGuid
            select new { Booking = booking, PropertyId = property.Id })
            .SingleOrDefaultAsync();

        if (bookingData is null)
            return Result.Failure("Booking not found.");

        if (bookingData.Booking.Status != BookingStatus.Pending)
            return Result.Failure("Only pending bookings can be approved.");

        var overlapExists = await _bookingRepository.HasOverlappingBookingAsync(
            bookingData.PropertyId,
            bookingData.Booking.StartDate,
            bookingData.Booking.EndDate,
            CancellationToken.None,
            bookingData.Booking.Id);

        if (overlapExists)
            return Result.Failure("Cannot approve booking because overlapping reserved dates already exist.");

        bookingData.Booking.Confirm();
        await _dbContext.SaveChangesAsync();

        return Result.Success("Booking approved successfully.");
    }

    public async Task<Result> RejectBookingAsync(Guid bookingId, string hostId)
    {
        if (!Guid.TryParse(hostId, out var hostGuid))
            return Result.Failure("Invalid host id.");

        var bookingData = await (
            from booking in _dbContext.Bookings
            join property in _dbContext.Properties on booking.PropertyId equals property.Id
            where booking.Id == bookingId && property.HostId == hostGuid
            select booking)
            .SingleOrDefaultAsync();

        if (bookingData is null)
            return Result.Failure("Booking not found.");

        if (bookingData.Status != BookingStatus.Pending)
            return Result.Failure("Only pending bookings can be rejected.");

        bookingData.Cancel();
        await _dbContext.SaveChangesAsync();

        return Result.Success("Booking rejected successfully.");
    }
}
