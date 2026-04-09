using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RentalsPlatform.Application.DTOs.Notifications;
using RentalsPlatform.Application.Interfaces;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Infrastructure.Data;
using WebPush;

namespace RentalsPlatform.Infrastructure.Services;

public class WebPushService : IWebPushService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly WebPushClient _webPushClient;
    private readonly VapidDetailsSettings _vapid;

    public WebPushService(
        ApplicationDbContext dbContext,
        WebPushClient webPushClient,
        IOptions<VapidDetailsSettings> vapidOptions)
    {
        _dbContext = dbContext;
        _webPushClient = webPushClient;
        _vapid = vapidOptions.Value;
    }

    public async Task SaveSubscriptionAsync(string userId, PushSubscriptionRequestDto request)
    {
        var existing = await _dbContext.PushSubscriptions
            .FirstOrDefaultAsync(x => x.UserId == userId && x.Endpoint == request.Endpoint);

        if (existing is null)
        {
            var model = new RentalsPlatform.Domain.Entities.PushSubscription(userId, request.Endpoint, request.P256dh, request.Auth);
            await _dbContext.PushSubscriptions.AddAsync(model);
        }
        else
        {
            existing.UpdateKeys(request.P256dh, request.Auth);
        }

        await _dbContext.SaveChangesAsync();
    }

    public async Task RemoveSubscriptionAsync(string userId, string endpoint)
    {
        var subscription = await _dbContext.PushSubscriptions
            .FirstOrDefaultAsync(x => x.UserId == userId && x.Endpoint == endpoint);

        if (subscription is null)
            return;

        _dbContext.PushSubscriptions.Remove(subscription);
        await _dbContext.SaveChangesAsync();
    }

    public async Task SendPushNotificationAsync(string userId, string title, string message, string targetUrl)
    {
        var subscriptions = await _dbContext.PushSubscriptions
            .AsNoTracking()
            .Where(s => s.UserId == userId)
            .ToListAsync();

        if (subscriptions.Count == 0)
            return;

        var payload = JsonSerializer.Serialize(new
        {
            title,
            message,
            url = targetUrl
        });

        var vapidDetails = new VapidDetails(_vapid.Subject, _vapid.PublicKey, _vapid.PrivateKey);

        foreach (var subscription in subscriptions)
        {
            var webPushSubscription = new WebPush.PushSubscription(subscription.Endpoint, subscription.P256dh, subscription.Auth);
            await _webPushClient.SendNotificationAsync(webPushSubscription, payload, vapidDetails);
        }
    }
}
