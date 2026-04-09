using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Application.DTOs.Calendar;
using RentalsPlatform.Application.Services;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Infrastructure.Data;

namespace RentalsPlatform.Infrastructure.Services;

public class HostCalendarService : IHostCalendarService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IAvailabilityService _availabilityService;

    public HostCalendarService(ApplicationDbContext dbContext, IAvailabilityService availabilityService)
    {
        _dbContext = dbContext;
        _availabilityService = availabilityService;
    }

    public async Task BlockDatesAsync(BlockDto dto, CancellationToken cancellationToken = default)
    {
        if (dto.StartDate >= dto.EndDate)
            throw new InvalidOperationException("End date must be after start date.");

        var propertyExists = await _dbContext.Properties
            .AsNoTracking()
            .AnyAsync(p => p.Id == dto.PropertyId, cancellationToken);

        if (!propertyExists)
            throw new InvalidOperationException("Property not found.");

        var isAvailable = await _availabilityService.IsPeriodAvailableAsync(dto.PropertyId, dto.StartDate, dto.EndDate);

        if (!isAvailable)
            throw new InvalidOperationException("Cannot block these dates because they overlap with existing calendar reservations.");

        var blockedPeriod = new UnavailableDate(dto.PropertyId, dto.StartDate, dto.EndDate, dto.Reason);
        await _dbContext.UnavailableDates.AddAsync(blockedPeriod, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task UnblockDatesAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var blockedPeriod = await _dbContext.UnavailableDates.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);

        if (blockedPeriod is null)
            throw new InvalidOperationException("Blocked period not found.");

        _dbContext.UnavailableDates.Remove(blockedPeriod);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
