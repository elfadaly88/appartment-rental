namespace RentalsPlatform.Domain.Entities;

public class Review
{
    public Guid Id { get; private set; }
    public Guid BookingId { get; private set; }
    public Guid PropertyId { get; private set; }
    public string GuestId { get; private set; } = string.Empty;
    public int Rating { get; private set; }
    public string Comment { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; }

    private Review() { }

    public Review(Guid bookingId, Guid propertyId, string guestId, int rating, string comment)
    {
        if (rating < 1 || rating > 5)
            throw new ArgumentOutOfRangeException(nameof(rating), "Rating must be between 1 and 5.");

        if (string.IsNullOrWhiteSpace(comment))
            throw new ArgumentException("Comment is required.", nameof(comment));

        if (comment.Length > 1000)
            throw new ArgumentException("Comment cannot exceed 1000 characters.", nameof(comment));

        Id = Guid.NewGuid();
        BookingId = bookingId;
        PropertyId = propertyId;
        GuestId = guestId;
        Rating = rating;
        Comment = comment.Trim();
        CreatedAt = DateTime.UtcNow;
    }
}
