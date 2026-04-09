using RentalsPlatform.Application.Common;
using RentalsPlatform.Application.DTOs.Reviews;

namespace RentalsPlatform.Application.Services;

public interface IReviewService
{
    Task<Result> SubmitReviewAsync(string guestId, SubmitReviewDto model);
    Task<PropertyReviewStatsDto> GetHostPropertyReviewsAsync(string hostId, Guid propertyId);
}
