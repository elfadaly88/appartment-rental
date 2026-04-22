using RentalsPlatform.Application.DTOs.Notifications;
using RentalsPlatform.Domain.Entities;

namespace RentalsPlatform.Application.Interfaces;

public interface INotificationService
{
    Task<IEnumerable<NotificationDto>> GetUserNotificationsAsync(string userId);
    Task MarkAsReadAsync(Guid notificationId);
    Task CreateNotificationAsync(Notification model);
    Task NotifyGroupAsync(string group, string method, object payload);
}