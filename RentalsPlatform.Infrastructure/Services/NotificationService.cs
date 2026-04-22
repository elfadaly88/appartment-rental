using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RentalsPlatform.Application.DTOs.Notifications;
using RentalsPlatform.Application.Interfaces;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Infrastructure.Data;
using Microsoft.AspNetCore.SignalR;
using RentalsPlatform.Infrastructure.Hubs;

namespace RentalsPlatform.Infrastructure.Services;

public class NotificationService : INotificationService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IWebPushService _webPushService;
    private readonly ILogger<NotificationService> _logger;
    private readonly IHubContext<NotificationHub> _hubContext;

    public NotificationService(
        ApplicationDbContext dbContext,
        IWebPushService webPushService,
        ILogger<NotificationService> logger,
        IHubContext<NotificationHub> hubContext)
    {
        _dbContext = dbContext;
        _webPushService = webPushService;
        _logger = logger;
        _hubContext = hubContext;
    }

    public async Task<IEnumerable<NotificationDto>> GetUserNotificationsAsync(string userId)
    {
        return await _dbContext.Notifications
            .AsNoTracking()
            .Where(n => n.UserId == userId)
            .OrderBy(n => n.IsRead)
            .ThenByDescending(n => n.CreatedAt)
            .Select(n => new NotificationDto(
                n.Id,
                n.Title,
                n.Message,
                n.CreatedAt,
                n.IsRead,
                n.TargetLink))
            .ToListAsync();
    }

    public async Task MarkAsReadAsync(Guid notificationId)
    {
        var notification = await _dbContext.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId);

        if (notification is null)
            return;

        notification.MarkAsRead();
        await _dbContext.SaveChangesAsync();
    }

    public async Task CreateNotificationAsync(Notification model)
    {
        await _dbContext.Notifications.AddAsync(model);
        await _dbContext.SaveChangesAsync();

        _ = Task.Run(async () =>
        {
            try
            {
                await _webPushService.SendPushNotificationAsync(model.UserId, model.Title, model.Message, model.TargetLink);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send web push notification for user {UserId}.", model.UserId);
            }
        });
    }

    public async Task NotifyGroupAsync(string group, string method, object payload)
    {
        await _hubContext.Clients.Group(group).SendAsync(method, payload);
    }
}
