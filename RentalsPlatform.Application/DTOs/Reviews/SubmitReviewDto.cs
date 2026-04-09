namespace RentalsPlatform.Application.DTOs.Reviews;

public class SubmitReviewDto
{
    public Guid BookingId { get; set; }
    public int Rating { get; set; }
    public string Comment { get; set; } = string.Empty;
}
