namespace RentalsPlatform.Application.DTOs.Notifications;

public record NotificationDto(
    Guid Id,
    string Title,
    string Message,
    DateTime CreatedAt,
    bool IsRead,
    string TargetLink);
