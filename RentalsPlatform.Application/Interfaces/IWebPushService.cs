using RentalsPlatform.Application.DTOs.Notifications;

namespace RentalsPlatform.Application.Interfaces;

public interface IWebPushService
{
    Task SaveSubscriptionAsync(string userId, PushSubscriptionRequestDto request);
    Task RemoveSubscriptionAsync(string userId, string endpoint);
    Task SendPushNotificationAsync(string userId, string title, string message, string targetUrl);
}
