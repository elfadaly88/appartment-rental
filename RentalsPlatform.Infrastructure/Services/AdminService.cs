using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Application.Common;
using RentalsPlatform.Application.DTOs.Admin;
using RentalsPlatform.Application.Interfaces;
using RentalsPlatform.Application.Services;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Domain.Enums;
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
            .Where(p => p.Status == PropertyStatus.Pending)
            .Join(
                _dbContext.Users.AsNoTracking(),
                property => property.HostId.ToString(),
                user => user.Id,
                (property, user) => new AdminPropertyDto
                {
                    Id = property.Id,
                    HostName = string.Join(" ", new[] { user.FirstName, user.LastName }.Where(x => !string.IsNullOrWhiteSpace(x))).Trim(),
                    Title = string.IsNullOrWhiteSpace(property.Name.En) ? property.Name.Ar : property.Name.En,
                    Description = string.IsNullOrWhiteSpace(property.Description.En) ? property.Description.Ar : property.Description.En,
                    Price = property.PricePerNight.Amount,
                    Images = Array.Empty<string>(),
                    Status = property.Status,
                    SubmittedAt = property.SubmittedAt
                })
            .OrderBy(p => p.SubmittedAt)
            .ToListAsync();

        return pendingProperties;
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
}
