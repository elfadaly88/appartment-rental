using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Application.Common;
using RentalsPlatform.Application.DTOs.Admin;
using RentalsPlatform.Application.Interfaces;
using RentalsPlatform.Application.Services;
using RentalsPlatform.Domain.Enums;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Infrastructure.Data;

namespace RentalsPlatform.Infrastructure.Services;

public class AdminService : IAdminService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly INotificationService _notificationService;

    public AdminService(ApplicationDbContext dbContext, INotificationService notificationService)
    {
        _dbContext = dbContext;
        _notificationService = notificationService;
    }

    public async Task<IEnumerable<AdminPropertyDto>> GetPendingPropertiesAsync()
    {
        var pendingProperties = await _dbContext.Properties
            .AsNoTracking()
            .Include(p => p.PropertyImages)
            .Where(p => p.Status == PropertyStatus.Pending)
            .Join(
                _dbContext.Users.AsNoTracking(),
                property => property.HostId.ToString(),
                user => user.Id,
                (property, user) => new
                {
                    Id = property.Id,
                    user.FirstName,
                    user.LastName,
                    user.Email,
                    TitleEn = property.Name.En,
                    TitleAr = property.Name.Ar,
                    DescriptionEn = property.Description.En,
                    DescriptionAr = property.Description.Ar,
                    PriceAmount = property.PricePerNight.Amount,
                    PriceCurrency = property.PricePerNight.Currency,
                    MaxGuests = property.MaxGuests,
                    Country = property.Location.Country,
                    City = property.Location.City,
                    Street = property.Location.Street,
                    Images = property.PropertyImages.OrderByDescending(i => i.IsMain).Select(i => i.Url).ToList(),
                    Status = property.Status,
                    SubmittedAt = property.SubmittedAt
                })
            .OrderBy(p => p.SubmittedAt)
            .ToListAsync();

        return pendingProperties.Select(property => new AdminPropertyDto
        {
            Id = property.Id,
            HostName = !string.IsNullOrWhiteSpace(property.FirstName) || !string.IsNullOrWhiteSpace(property.LastName)
                ? string.Join(" ", new[] { property.FirstName, property.LastName }.Where(x => !string.IsNullOrWhiteSpace(x))).Trim()
                : property.Email ?? string.Empty,
            Title = string.IsNullOrWhiteSpace(property.TitleEn) ? property.TitleAr ?? string.Empty : property.TitleEn,
            Description = string.IsNullOrWhiteSpace(property.DescriptionEn) ? property.DescriptionAr ?? string.Empty : property.DescriptionEn,
            PriceAmount = property.PriceAmount,
            PriceCurrency = property.PriceCurrency,
            MaxGuests = property.MaxGuests,
            Area = 270, // Mocked for UI requirements
            Bedrooms = 3, // Mocked for UI requirements
            Bathrooms = 2, // Mocked for UI requirements
            Amenities = new[] { "WiFi", "AC", "Pool", "Gym", "Smart TV", "Parking" }, // Mocked for UI requirements
            ServiceFee = property.PriceAmount * 0.1m, // 10% service fee mock
            SecurityDeposit = 1000m, // Mocked deposit
            Country = string.IsNullOrWhiteSpace(property.Country) ? "Unknown" : property.Country,
            City = string.IsNullOrWhiteSpace(property.City) ? "Unknown" : property.City,
            Street = string.IsNullOrWhiteSpace(property.Street) ? "" : property.Street,
            Images = property.Images,
            Status = property.Status,
            SubmittedAt = property.SubmittedAt
        });
    }

    public async Task<Result> ApprovePropertyAsync(Guid propertyId)
    {
        var property = await _dbContext.Properties.FirstOrDefaultAsync(p => p.Id == propertyId);
        if (property is null)
            return Result.Failure("Property not found.");

        if (property.Status == PropertyStatus.Approved)
            return Result.Failure("Property is already approved.");

        property.Approve();
        await _dbContext.SaveChangesAsync();

        await _notificationService.CreateNotificationAsync(
            new Notification(
                property.HostId.ToString(),
                "Property Approved",
                "Your property has been approved and is now visible to guests.",
                $"/host/properties/{property.Id}"));

        return Result.Success("Property approved successfully.");
    }

    public async Task<Result> RejectPropertyAsync(Guid propertyId, string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            return Result.Failure("Rejection reason is required.");

        var property = await _dbContext.Properties.FirstOrDefaultAsync(p => p.Id == propertyId);
        if (property is null)
            return Result.Failure("Property not found.");

        property.Reject(reason);
        await _dbContext.SaveChangesAsync();

        await _notificationService.CreateNotificationAsync(
            new Notification(
                property.HostId.ToString(),
                "Property Rejected",
                $"Your property submission was rejected. Reason: {reason}",
                $"/host/properties/{property.Id}"));

        return Result.Success("Property rejected successfully.");
    }

    public async Task<IEnumerable<AdminBookingDto>> GetAllBookingsAsync()
    {
        var bookings = await _dbContext.Bookings
            .AsNoTracking()
            .OrderByDescending(b => b.CreatedOnUtc)
            .ToListAsync();

        if (bookings.Count == 0)
            return [];

        var propertyIds = bookings.Select(b => b.PropertyId).Distinct().ToList();
        var properties = await _dbContext.Properties
            .AsNoTracking()
            .Where(p => propertyIds.Contains(p.Id))
            .ToListAsync();

        var propertyById = properties.ToDictionary(p => p.Id);

        var guestIdSet = bookings
            .Select(b => b.GuestId)
            .Where(id => id != Guid.Empty)
            .Select(id => id.ToString())
            .ToHashSet();

        var hostIdSet = properties
            .Select(p => p.HostId)
            .Where(id => id != Guid.Empty)
            .Select(id => id.ToString())
            .ToHashSet();

        var userIds = guestIdSet.Union(hostIdSet).ToList();
        var users = await _dbContext.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToListAsync();

        var userById = users.ToDictionary(u => u.Id);

        var transactions = await _dbContext.Transactions
            .AsNoTracking()
            .Where(t => bookings.Select(b => b.Id).Contains(t.BookingId))
            .ToListAsync();

        var transactionIdByBookingId = transactions
            .GroupBy(t => t.BookingId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.CreatedOnUtc).First().Id.ToString());

        var result = new List<AdminBookingDto>(bookings.Count);

        foreach (var booking in bookings)
        {
            propertyById.TryGetValue(booking.PropertyId, out var property);

            var guestEmail = string.Empty;
            var hostName = string.Empty;

            if (booking.GuestId != Guid.Empty && userById.TryGetValue(booking.GuestId.ToString(), out var guest))
                guestEmail = guest.Email ?? string.Empty;

            if (property is not null && userById.TryGetValue(property.HostId.ToString(), out var host))
            {
                hostName = string.Join(" ", new[] { host.FirstName, host.LastName }
                    .Where(x => !string.IsNullOrWhiteSpace(x))).Trim();

                if (string.IsNullOrWhiteSpace(hostName))
                    hostName = host.Email ?? string.Empty;
            }

            var transactionId = transactionIdByBookingId.GetValueOrDefault(booking.Id);
            if (string.IsNullOrWhiteSpace(transactionId) && !string.IsNullOrWhiteSpace(booking.PaymobOrderId))
                transactionId = booking.PaymobOrderId;

            result.Add(new AdminBookingDto
            {
                Id = booking.Id,
                PropertyId = booking.PropertyId,
                PropertyTitle = property is null
                    ? string.Empty
                    : (string.IsNullOrWhiteSpace(property.Name.En) ? property.Name.Ar : property.Name.En),
                HostName = hostName,
                GuestEmail = guestEmail,
                StartDate = booking.StartDate,
                EndDate = booking.EndDate,
                TotalPrice = booking.TotalPrice.Amount,
                Currency = booking.TotalPrice.Currency,
                BookingStatus = booking.Status,
                PaymentStatus = booking.PaymentStatus,
                IsPaid = booking.PaymentStatus == PaymentStatus.Paid,
                PaymentProvider = string.IsNullOrWhiteSpace(booking.PaymobOrderId) ? string.Empty : "Paymob",
                TransactionId = transactionId,
                CreatedOnUtc = booking.CreatedOnUtc
            });
        }

        return result;
    }

    public async Task<AdminFinancialSummaryDto> GetFinancialSummaryAsync()
    {
        var totalRevenue = await _dbContext.Bookings
            .AsNoTracking()
            .Where(b => b.PaymentStatus == PaymentStatus.Paid)
            .SumAsync(b => (decimal?)b.TotalPrice.Amount) ?? 0m;

        var activeUsers = await _dbContext.Users
            .AsNoTracking()
            .CountAsync(u => string.IsNullOrWhiteSpace(u.BanReason));

        var pendingApprovals = await _dbContext.Properties
            .AsNoTracking()
            .CountAsync(p => p.Status == PropertyStatus.Pending);

        return new AdminFinancialSummaryDto
        {
            TotalRevenue = totalRevenue,
            ActiveUsers = activeUsers,
            PendingApprovals = pendingApprovals
        };
    }
}
