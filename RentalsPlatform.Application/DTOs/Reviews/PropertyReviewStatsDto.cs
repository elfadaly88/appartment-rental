namespace RentalsPlatform.Application.DTOs.Reviews;

public class PropertyReviewStatsDto
{
    public double AverageRating { get; init; }
    public int TotalReviews { get; init; }
    public List<ReviewDto> Reviews { get; init; } = [];
}
