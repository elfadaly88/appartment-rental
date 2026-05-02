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
    private const decimal PlatformFeeRate = 0.10m; // 10 % platform fee

    private readonly IBookingRepository _bookingRepository;
    private readonly IPropertyRepository _propertyRepository;
    private readonly INotificationService _notificationService;
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly ApplicationDbContext _dbContext;
    private readonly IPricingService _pricingService;
    private readonly IAvailabilityService _availabilityService;
    private readonly IPaymobService _paymobService;

    public BookingService(
        IBookingRepository bookingRepository,
        IPropertyRepository propertyRepository,
        INotificationService notificationService,
        IHubContext<NotificationHub> hubContext,
        ApplicationDbContext dbContext,
        IPricingService pricingService,
        IAvailabilityService availabilityService,
        IPaymobService paymobService)
    {
        _bookingRepository = bookingRepository;
        _propertyRepository = propertyRepository;
        _notificationService = notificationService;
        _hubContext = hubContext;
        _dbContext = dbContext;
        _pricingService = pricingService;
        _availabilityService = availabilityService;
        _paymobService = paymobService;
    }

    // ── Create ───────────────────────────────────────────────────────

    public async Task<Guid> CreateGuestBookingAsync(Guid propertyId, Guid guestId, DateOnly checkInDate, DateOnly checkOutDate, CancellationToken cancellationToken = default)
    {
        using var transaction = await _dbContext.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted, cancellationToken);
        try
        {
            var property = await _dbContext.Properties
                .FromSqlRaw("SELECT * FROM \"Properties\" WHERE \"Id\" = {0} FOR UPDATE", propertyId)
                .FirstOrDefaultAsync(cancellationToken);

            if (property is null)
                throw new InvalidOperationException("Property not found.");

            // ── Smart availability check: Priority — Blocked > Booked ────────
            // Checks both UnavailableDates (host-blocked) and existing bookings in one call.
            //var isAvailable = await _availabilityService.IsPeriodAvailableAsync(dto.PropertyId, dto.CheckIn, dto.CheckOut);[cite: 1]
            var isAvailable = await _availabilityService.IsPeriodAvailableAsync(propertyId, checkInDate, checkOutDate);
            if (!isAvailable)
                throw new InvalidOperationException("Sorry, some dates in your selection are unavailable. Please choose different dates.");

            var duration = new DateRange(checkInDate, checkOutDate);
            var booking = new Booking(property.Id, guestId, duration, property.PricePerNight);
            var pricing = await _pricingService.CalculatePricingAsync(propertyId, checkInDate, checkOutDate);
            booking.SetPricingDetails(pricing.SubTotal, pricing.DiscountAmount, pricing.FinalAmount, pricing.Currency, pricing.DiscountLabel);

            property.MarkAsBooked();
            await _bookingRepository.AddAsync(booking, cancellationToken);
            await _propertyRepository.SaveChangesAsync(cancellationToken);

            var propertyName = string.IsNullOrWhiteSpace(property.Name.En) ? property.Name.Ar : property.Name.En;
            var guest = await _dbContext.Users
                .AsNoTracking()
                .Where(u => u.Id == guestId.ToString())
                .Select(u => new { u.FirstName, u.LastName, u.Email })
                .FirstOrDefaultAsync(cancellationToken);

            var guestName = guest is null
                ? "Guest"
                : string.IsNullOrWhiteSpace($"{guest.FirstName} {guest.LastName}".Trim())
                    ? (guest.Email ?? "Guest")
                    : $"{guest.FirstName} {guest.LastName}".Trim();

            var message = $"New booking request from {guestName} for {propertyName}";
            var targetLink = $"/host/bookings/{booking.Id}";

            var notification = new Notification(property.HostId.ToString(), "New Booking Request", message, targetLink);
            await _notificationService.CreateNotificationAsync(notification);

            var notificationPayload = new BookingNotificationPayload(booking.Id, propertyName, guestName, message);
            await _hubContext.Clients.User(property.HostId.ToString())
                .SendAsync("ReceiveNotification", notificationPayload, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return booking.Id;
        }
        catch (System.Exception)
        {
            await transaction.RollbackAsync();
            throw;
        }

    }

    public async Task<decimal> CalculateGuestBookingTotalAsync(Guid propertyId, DateOnly checkInDate, DateOnly checkOutDate, CancellationToken cancellationToken = default)
    {
        var property = await _propertyRepository.GetByIdAsync(propertyId, cancellationToken);
        if (property is null)
            throw new InvalidOperationException("Property not found.");

        return await _pricingService.CalculateTotalAmountAsync(propertyId, checkInDate, checkOutDate);
    }

    public async Task BlockDatesAsync(BlockDatesDto dto, CancellationToken cancellationToken = default)
    {
        var property = await _propertyRepository.GetByIdAsync(dto.PropertyId, cancellationToken);
        if (property is null)
            throw new InvalidOperationException("Property not found.");

        var hasOverlap = await _bookingRepository.HasOverlappingBookingAsync(
            dto.PropertyId, dto.StartDate, dto.EndDate, cancellationToken);

        if (hasOverlap)
            throw new InvalidOperationException("Cannot block these dates because they overlap with an existing reservation.");

        var blockedBooking = Booking.CreateHostBlock(dto.PropertyId, dto.StartDate, dto.EndDate, dto.Reason);
        await _bookingRepository.AddAsync(blockedBooking, cancellationToken);
        await _propertyRepository.SaveChangesAsync(cancellationToken);
    }

    // ── Host queries ─────────────────────────────────────────────────

    public async Task<IEnumerable<HostBookingDto>> GetHostBookingsAsync(string hostId)
    {
        if (!Guid.TryParse(hostId, out var hostGuid))
            return Enumerable.Empty<HostBookingDto>();

        var hostBookings = await (
            from booking in _dbContext.Bookings.AsNoTracking()
            join property in _dbContext.Properties.AsNoTracking() on booking.PropertyId equals property.Id
            join guest in _dbContext.Users.AsNoTracking() on booking.GuestId.ToString() equals guest.Id into guestJoin
            from guest in guestJoin.DefaultIfEmpty()
            where property.HostId == hostGuid
            orderby booking.StartDate descending
            select new
            {
                booking.Id,
                PropertyName = property.Name.En,
                booking.GuestId,
                GuestPhone = guest == null ? null : guest.PhoneNumber,
                booking.StartDate,
                booking.EndDate,
                TotalPrice = booking.TotalPrice.Amount,
                booking.Status,
                booking.PaymentStatus
            })
            .ToListAsync();

        var guestIds = hostBookings.Select(x => x.GuestId.ToString()).Distinct().ToList();

        // Fetch raw name parts — EF Core / Npgsql cannot translate
        // `new[] { ... }.Where(predicate)` inside a SQL projection.
        // String assembly is done in-memory after the DB round-trip.
        var guestRaw = await _dbContext.Users
            .AsNoTracking()
            .Where(u => guestIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FirstName, u.LastName })
            .ToListAsync();

        var guests = guestRaw.ToDictionary(
            x => x.Id,
            x =>
            {
                var full = string.Join(
                    " ",
                    new[] { x.FirstName, x.LastName }
                        .Where(v => !string.IsNullOrWhiteSpace(v))
                ).Trim();
                return string.IsNullOrWhiteSpace(full) ? "Unknown Guest" : full;
            });

        return hostBookings.Select(x =>
        {
            var guestId = x.GuestId.ToString();
            var guestName = guests.TryGetValue(guestId, out var name) ? name : "Unknown Guest";
            var normalizedPhone = EgyptianPhoneNumber.NormalizeToLocal(x.GuestPhone);
            var hasValidPhone = EgyptianPhoneNumber.IsValidLocal(normalizedPhone);
            var isVerified = hasValidPhone && x.PaymentStatus == PaymentStatus.Paid;
            var maskedPhone = hasValidPhone ? MaskPhone(normalizedPhone) : null;
            var fullPhone = isVerified ? normalizedPhone : null;

            return new HostBookingDto(
                x.Id,
                x.PropertyName,
                guestName,
                maskedPhone,
                fullPhone,
                isVerified,
                x.StartDate,
                x.EndDate,
                x.TotalPrice,
                x.Status);
        });
    }

    public async Task<IEnumerable<HostPipelineBookingDto>> GetHostPipelineAsync(string hostId)
    {
        if (!Guid.TryParse(hostId, out var hostGuid))
            return Enumerable.Empty<HostPipelineBookingDto>();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var pipeline = await (
            from booking in _dbContext.Bookings.AsNoTracking()
            join property in _dbContext.Properties.AsNoTracking() on booking.PropertyId equals property.Id
            join guest in _dbContext.Users.AsNoTracking() on booking.GuestId.ToString() equals guest.Id into guestJoin
            from guest in guestJoin.DefaultIfEmpty()
            where property.HostId == hostGuid
                && (booking.Status == BookingStatus.Pending
                    || booking.Status == BookingStatus.Approved
                    || booking.Status == BookingStatus.Confirmed)
                && booking.EndDate >= today
            orderby booking.StartDate
            select new
            {
                booking.Id,
                booking.PropertyId,
                PropertyTitle = string.IsNullOrWhiteSpace(property.Name.En) ? property.Name.Ar : property.Name.En,
                booking.GuestId,
                GuestName = guest == null
                    ? "Guest"
                    : string.IsNullOrWhiteSpace((guest.FirstName + " " + guest.LastName).Trim())
                        ? (guest.Email ?? "Guest")
                        : (guest.FirstName + " " + guest.LastName).Trim(),
                GuestEmail = guest == null ? string.Empty : (guest.Email ?? string.Empty),
                GuestAvatarUrl = guest == null ? null : guest.AvatarUrl,
                booking.StartDate,
                booking.EndDate,
                TotalPrice = booking.TotalPrice.Amount,
                Currency = booking.TotalPrice.Currency,
                booking.Status,
                booking.ApprovedAt
            })
            .ToListAsync();

        return pipeline.Select(x =>
        {
            var netProfit = Math.Round(x.TotalPrice * (1 - PlatformFeeRate), 2);
            DateTime? softBlockUntil = x.Status == BookingStatus.Approved && x.ApprovedAt.HasValue
                ? x.ApprovedAt.Value.AddHours(24)
                : null;

            var pipelineStatus = x.Status switch
            {
                BookingStatus.Pending => "Pending",
                BookingStatus.Approved => "Approved",
                BookingStatus.Confirmed when x.StartDate <= today => "Arriving",
                _ => "Confirmed"
            };

            return new HostPipelineBookingDto(
                x.Id,
                x.PropertyId,
                x.PropertyTitle,
                x.GuestId,
                x.GuestName,
                x.GuestEmail,
                x.GuestAvatarUrl,
                x.StartDate,
                x.EndDate,
                x.TotalPrice,
                netProfit,
                x.Currency,
                pipelineStatus,
                softBlockUntil);
        });
    }

    private static string MaskPhone(string phone)
    {
        if (phone.Length < 11)
            return phone;

        return $"{phone[..3]}{new string('•', 6)}{phone[^2..]}";
    }

    // ── Host actions ──────────────────────────────────────────────────

    public async Task<Result> ApproveBookingAsync(Guid bookingId, string hostId)
    {
        if (!Guid.TryParse(hostId, out var hostGuid))
            return Result.Failure("Invalid host id.");

        var bookingData = await (
            from booking in _dbContext.Bookings
            join property in _dbContext.Properties on booking.PropertyId equals property.Id
            where booking.Id == bookingId && property.HostId == hostGuid
            select new { Booking = booking, PropertyId = property.Id, PropertyName = property.Name.En ?? property.Name.Ar, property.HostId })
            .SingleOrDefaultAsync();

        if (bookingData is null)
            return Result.Failure("Booking not found.");

        if (bookingData.Booking.Status != BookingStatus.Pending)
            return Result.Failure("Only pending bookings can be approved.");

        // ── Date guard: prevent approving a booking whose check-in date has already passed ──
        var todayUtc = DateOnly.FromDateTime(DateTime.UtcNow);
        if (bookingData.Booking.StartDate <= todayUtc)
            return Result.Failure("Cannot approve a booking that has already started or whose check-in date has passed.");

        var overlapExists = await _bookingRepository.HasOverlappingBookingAsync(
            bookingData.PropertyId,
            bookingData.Booking.StartDate,
            bookingData.Booking.EndDate,
            CancellationToken.None,
            bookingData.Booking.Id);

        if (overlapExists)
            return Result.Failure("Cannot approve booking because overlapping reserved dates already exist.");

        // Soft-block: move status to Approved (24-hour payment window)
        bookingData.Booking.Approve();
        await _dbContext.SaveChangesAsync();

        // Notify guest
        var guestNotification = new Notification(
            bookingData.Booking.GuestId.ToString(),
            "Booking Approved – Pay Now!",
            "Your booking request has been approved. Please complete payment within 24 hours to confirm your stay.",
            $"/my-bookings");

        await _notificationService.CreateNotificationAsync(guestNotification);

        await _hubContext.Clients.User(bookingData.Booking.GuestId.ToString())
            .SendAsync("ReceiveNotification", new
            {
                bookingData.Booking.Id,
                Title = "Booking Approved!",
                Message = "Pay within 24 hours to confirm your stay.",
                TargetLink = "/my-bookings"
            });

        return Result.Success("Booking approved successfully. Guest has 24 hours to pay.");
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

        if (bookingData.Status != BookingStatus.Pending && bookingData.Status != BookingStatus.Approved)
            return Result.Failure("Only pending or approved bookings can be rejected.");

        bookingData.Cancel();
        await _dbContext.SaveChangesAsync();

        return Result.Success("Booking rejected successfully.");
    }

    public async Task<Result> ConfirmCheckInAsync(Guid bookingId, string hostId)
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

        if (bookingData.Status == BookingStatus.Approved || bookingData.Status == BookingStatus.Pending)
        {
            bookingData.Confirm();
            await _dbContext.SaveChangesAsync();
            return Result.Success("Check-in confirmed successfully.");
        }

        if (bookingData.Status == BookingStatus.Confirmed)
            return Result.Success("Booking already confirmed.");

        return Result.Failure("Only pending, approved, or confirmed bookings can be check-in confirmed.");
    }

    // ── Guest actions ─────────────────────────────────────────────────

    public async Task<IEnumerable<GuestBookingDto>> GetGuestBookingsAsync(Guid guestId, CancellationToken cancellationToken = default)
    {
        return await (
            from booking in _dbContext.Bookings.AsNoTracking()
            join property in _dbContext.Properties.AsNoTracking() on booking.PropertyId equals property.Id
            where booking.GuestId == guestId && booking.Status != BookingStatus.HostBlocked
            orderby booking.StartDate descending
            select new GuestBookingDto(
                booking.Id,
                property.Id,
                string.IsNullOrWhiteSpace(property.Name.En) ? property.Name.Ar : property.Name.En,
                property.PropertyImages
                    .OrderByDescending(i => i.IsMain)
                    .Select(i => i.Url)
                    .FirstOrDefault(),
                booking.StartDate,
                booking.EndDate,
                booking.EndDate.DayNumber - booking.StartDate.DayNumber,
                booking.TotalPrice.Amount,
                booking.OriginalPrice.Amount,
                booking.DiscountAmount,
                booking.DiscountLabel,
                booking.TotalPrice.Currency,
                booking.Status,
                booking.PaymentStatus,
                booking.ApprovedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<Result> CancelGuestBookingAsync(Guid bookingId, Guid guestId)
    {
        var booking = await _dbContext.Bookings
            .FirstOrDefaultAsync(b => b.Id == bookingId && b.GuestId == guestId);

        if (booking is null)
            return Result.Failure("Booking not found.");
            
        using var transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            if (booking.PaymentStatus == PaymentStatus.Paid)
            {
                var refundAccepted = await _paymobService.RefundAsync(booking.Id);
                if (!refundAccepted)
                    return Result.Failure("فشل استرداد المبلغ، يرجى التواصل مع الدعم.");
            }

            var softBlocks = await _dbContext.UnavailableDates
                .Where(u => u.PropertyId == booking.PropertyId && u.BookingId == booking.Id)
                .ToListAsync();

            if (softBlocks.Any())
                _dbContext.UnavailableDates.RemoveRange(softBlocks);
                
            booking.GuestCancel();
            await _dbContext.SaveChangesAsync();
            
            await transaction.CommitAsync();

            var property = await _dbContext.Properties.FindAsync(booking.PropertyId);
            if (property != null)
            {
                await _hubContext.Clients.User(property.HostId.ToString())
                    .SendAsync("ReceiveNotification", new
                    {
                        BookingId = booking.Id,
                        Status = booking.Status.ToString(),
                        Message = "Guest has cancelled; dates are now available"
                    });
            }

            return Result.Success("Booking cancelled successfully.");
        }
        catch (System.Exception ex)
        {
            await transaction.RollbackAsync();
            return Result.Failure(ex is InvalidOperationException ? ex.Message : "An error occurred during cancellation.");
        }
    }

    // ── Hangfire background job ───────────────────────────────────────

    /// <summary>
    /// Called by Hangfire every 15 minutes.
    /// Expires any Approved booking whose 24-hour payment window has lapsed,
    /// then notifies both Guest and Host.
    /// </summary>
    public async Task ExpireApprovedBookingsAsync()
    {
        var expiryThreshold = DateTime.UtcNow.AddHours(-24);

        // Load expired bookings with property name to include in notifications
        var expiredData = await (
            from booking in _dbContext.Bookings
            join property in _dbContext.Properties on booking.PropertyId equals property.Id
            where booking.Status == BookingStatus.Approved
               && booking.ApprovedAt.HasValue
               && booking.ApprovedAt.Value <= expiryThreshold
            select new
            {
                Booking = booking,
                PropertyName = property.Name.En ?? property.Name.Ar,
                HostIdStr = property.HostId.ToString()
            })
            .ToListAsync();

        if (expiredData.Count == 0)
            return;

        foreach (var item in expiredData)
        {
            item.Booking.Expire();
            
            var softBlocks = await _dbContext.UnavailableDates
                .Where(u => u.BookingId == item.Booking.Id)
                .ToListAsync();

            if (softBlocks.Any())
                _dbContext.UnavailableDates.RemoveRange(softBlocks);
        }

        await _dbContext.SaveChangesAsync();

        // Fire-and-forget: send notifications after DB is committed
        _ = Task.Run(async () =>
        {
            foreach (var item in expiredData)
            {
                var propertyLabel = item.PropertyName;
                var msg = $"Booking for {propertyLabel} has been cancelled as the payment deadline passed.";

                // Notify Guest
                await _notificationService.CreateNotificationAsync(
                    new Notification(
                        item.Booking.GuestId.ToString(),
                        "Booking Expired",
                        msg,
                        "/my-bookings"));

                // Notify Host
                await _notificationService.CreateNotificationAsync(
                    new Notification(
                        item.HostIdStr,
                        "Booking Expired",
                        msg,
                        "/host/bookings"));

                // Real-time push via SignalR
                await _hubContext.Clients.User(item.Booking.GuestId.ToString())
                    .SendAsync("ReceiveNotification", new
                    {
                        item.Booking.Id,
                        Title = "Booking Expired",
                        Message = msg,
                        TargetLink = "/my-bookings"
                    });

                await _hubContext.Clients.User(item.HostIdStr)
                    .SendAsync("ReceiveNotification", new
                    {
                        item.Booking.Id,
                        Title = "Booking Expired",
                        Message = msg,
                        TargetLink = "/host/bookings"
                    });
            }
        });
    }
}
