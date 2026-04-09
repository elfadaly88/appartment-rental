using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalsPlatform.Application.DTOs.Notifications;
using RentalsPlatform.Application.Interfaces;
using WebPush;

namespace RentalsPlatform.Api.Controllers;

public record TestPushRequestDto(
    [property: Required] string UserId,
    [property: Required] string Title,
    [property: Required] string Message);

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;
    private readonly IWebPushService _webPushService;

    public NotificationsController(
        INotificationService notificationService,
        IWebPushService webPushService)
    {
        _notificationService = notificationService;
        _webPushService = webPushService;
    }

    [HttpGet]
    public async Task<IActionResult> GetMyNotifications()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
            return Unauthorized();

        var notifications = await _notificationService.GetUserNotificationsAsync(userId);
        return Ok(notifications);
    }

    [HttpPatch("{id:guid}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        await _notificationService.MarkAsReadAsync(id);
        return Ok(new { Message = "Notification marked as read." });
    }

    [HttpPost("push/subscribe")]
    public async Task<IActionResult> SubscribeToPush([FromBody] PushSubscriptionRequestDto request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
            return Unauthorized();

        await _webPushService.SaveSubscriptionAsync(userId, request);
        return Ok(new { Message = "Push subscription saved successfully." });
    }

    [HttpDelete("push/unsubscribe")]
    public async Task<IActionResult> UnsubscribeFromPush([FromBody] PushUnsubscribeRequestDto request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
            return Unauthorized();

        await _webPushService.RemoveSubscriptionAsync(userId, request.Endpoint);
        return Ok(new { Message = "Push subscription removed successfully." });
    }

    [HttpPost("test-push")]
    public async Task<IActionResult> TestPush([FromBody] TestPushRequestDto request)
    {
        try
        {
            await _webPushService.SendPushNotificationAsync(request.UserId, request.Title, request.Message, "/");
            return Ok(new { Message = "Test push notification sent successfully." });
        }
        catch (WebPushException ex)
        {
            return BadRequest(new
            {
                Message = "Failed to send test push notification.",
                Error = ex.Message,
                StatusCode = ex.StatusCode
            });
        }
    }
}
