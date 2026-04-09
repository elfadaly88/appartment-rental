using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Application.Common;
using RentalsPlatform.Application.DTOs.Reviews;
using RentalsPlatform.Application.Services;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Domain.Enums;
using RentalsPlatform.Infrastructure.Data;

namespace RentalsPlatform.Infrastructure.Services;

public class ReviewService : IReviewService
{
    private readonly ApplicationDbContext _dbContext;

    public ReviewService(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Result> SubmitReviewAsync(string guestId, SubmitReviewDto model)
    {
        var booking = await _dbContext.Bookings
            .AsNoTracking()
            .Where(b => b.Id == model.BookingId)
            .Select(b => new
            {
                b.Id,
                b.PropertyId,
                GuestId = b.GuestId.ToString(),
                b.Status,
                b.EndDate
            })
            .FirstOrDefaultAsync();

        if (booking is null)
            return Result.Failure("Booking not found.");

        if (!string.Equals(booking.GuestId, guestId, StringComparison.OrdinalIgnoreCase))
            return Result.Failure("You are not allowed to review this booking.");

        var hasCheckedOut = booking.EndDate < DateOnly.FromDateTime(DateTime.UtcNow);
        if (booking.Status != BookingStatus.Completed && !hasCheckedOut)
            return Result.Failure("Review can only be submitted after checkout.");

        var alreadyReviewed = await _dbContext.Reviews
            .AsNoTracking()
            .AnyAsync(r => r.BookingId == model.BookingId);

        if (alreadyReviewed)
            return Result.Failure("A review already exists for this booking.");

        try
        {
            var review = new Review(model.BookingId, booking.PropertyId, guestId, model.Rating, model.Comment);
            await _dbContext.Reviews.AddAsync(review);
            await _dbContext.SaveChangesAsync();
            return Result.Success("Review submitted successfully.");
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return Result.Failure(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure(ex.Message);
        }
    }

    public async Task<PropertyReviewStatsDto> GetHostPropertyReviewsAsync(string hostId, Guid propertyId)
    {
        if (!Guid.TryParse(hostId, out var hostGuid))
            return new PropertyReviewStatsDto();

        var isHostProperty = await _dbContext.Properties
            .AsNoTracking()
            .AnyAsync(p => p.Id == propertyId && p.HostId == hostGuid);

        if (!isHostProperty)
            return new PropertyReviewStatsDto();

        var totalReviews = await _dbContext.Reviews
            .AsNoTracking()
            .Where(r => r.PropertyId == propertyId)
            .CountAsync();

        var averageRating = totalReviews == 0
            ? 0d
            : await _dbContext.Reviews
                .AsNoTracking()
                .Where(r => r.PropertyId == propertyId)
                .AverageAsync(r => (double)r.Rating);

        var reviews = await _dbContext.Reviews
            .AsNoTracking()
            .Where(r => r.PropertyId == propertyId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new ReviewDto(
                r.Id,
                r.BookingId,
                r.GuestId,
                r.Rating,
                r.Comment,
                r.CreatedAt))
            .ToListAsync();

        return new PropertyReviewStatsDto
        {
            AverageRating = Math.Round(averageRating, 2),
            TotalReviews = totalReviews,
            Reviews = reviews
        };
    }
}
