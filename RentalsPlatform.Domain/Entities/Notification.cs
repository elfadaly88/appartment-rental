namespace RentalsPlatform.Domain.Entities;

public class Notification
{
    public Guid Id { get; private set; }
    public string UserId { get; private set; } = string.Empty;
    public string Title { get; private set; } = string.Empty;
    public string Message { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; }
    public bool IsRead { get; private set; }
    public string TargetLink { get; private set; } = string.Empty;

    private Notification() { }

    public Notification(string userId, string title, string message, string targetLink)
    {
        Id = Guid.NewGuid();
        UserId = userId;
        Title = title;
        Message = message;
        TargetLink = targetLink;
        CreatedAt = DateTime.UtcNow;
        IsRead = false;
    }

    public void MarkAsRead()
    {
        IsRead = true;
    }
}
