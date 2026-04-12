using Hangfire;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Application.Interfaces;
using RentalsPlatform.Application.Services;
using RentalsPlatform.Infrastructure.Data;
using RentalsPlatform.Infrastructure.Hubs;
using RentalsPlatform.Infrastructure.Services;

namespace RentalsPlatform.Api.Controllers;

public record SimulatePaymobRequest(Guid BookingId, bool Success = true);

[ApiController]
[Route("api/webhooks")]
public class WebhooksController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IPaymobService _paymobService;
    private readonly INotificationService _notificationService;
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly IBackgroundJobClient _backgroundJobClient;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<WebhooksController> _logger;

    public WebhooksController(
        ApplicationDbContext dbContext,
        IPaymobService paymobService,
        INotificationService notificationService,
        IHubContext<NotificationHub> hubContext,
        IBackgroundJobClient backgroundJobClient,
        IWebHostEnvironment environment,
        ILogger<WebhooksController> logger)
    {
        _dbContext = dbContext;
        _paymobService = paymobService;
        _notificationService = notificationService;
        _hubContext = hubContext;
        _backgroundJobClient = backgroundJobClient;
        _environment = environment;
        _logger = logger;
    }

    [AllowAnonymous]
    [HttpPost("paymob-callback")]
    public async Task<IActionResult> PaymobCallback()
    {
        var query = Request.Query;
        var receivedHmac = query["hmac"].ToString();

        if (string.IsNullOrWhiteSpace(receivedHmac))
            return Unauthorized(new { Message = "Missing HMAC." });

        if (!_paymobService.VerifyPaymobHmac(query, receivedHmac))
        {
            _logger.LogCritical("SECURITY ALERT: Invalid Paymob callback HMAC. Query: {QueryString}", Request.QueryString.Value);
            return Unauthorized(new { Message = "Invalid HMAC signature." });
        }

        var paymobOrderId = query["order"].ToString();
        if (string.IsNullOrWhiteSpace(paymobOrderId))
            return BadRequest(new { Message = "Missing order id." });

        var booking = await _dbContext.Bookings.FirstOrDefaultAsync(b => b.PaymobOrderId == paymobOrderId);
        if (booking is null)
            return NotFound(new { Message = "Booking not found for this Paymob order." });

        var isSuccess = bool.TryParse(query["success"].ToString(), out var successFlag) && successFlag;
        await ProcessPaymentResultAsync(booking, isSuccess);

        return Ok(new { Message = "Callback processed." });
    }

    [AllowAnonymous]
    [HttpPost("simulate-paymob")]
    public async Task<IActionResult> SimulatePaymob([FromBody] SimulatePaymobRequest request)
    {
        if (!_environment.IsDevelopment())
            return NotFound();

        var booking = await _dbContext.Bookings.FirstOrDefaultAsync(b => b.Id == request.BookingId);
        if (booking is null)
            return NotFound(new { Message = "Booking not found." });

        await ProcessPaymentResultAsync(booking, request.Success);

        return Ok(new { Message = request.Success ? "Mock payment marked as paid." : "Mock payment marked as failed." });
    }

    private async Task ProcessPaymentResultAsync(Domain.Entities.Booking booking, bool success)
    {
        var property = await _dbContext.Properties.AsNoTracking().FirstOrDefaultAsync(p => p.Id == booking.PropertyId);
        var guest = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == booking.GuestId.ToString());

        if (success)
        {
            booking.MarkPaymentPaid();

            var guestFullName = guest is null
                ? "A guest"
                : string.Join(" ", new[] { guest.FirstName, guest.LastName }
                      .Where(x => !string.IsNullOrWhiteSpace(x))).Trim();
            if (string.IsNullOrWhiteSpace(guestFullName)) guestFullName = "A guest";

            if (property is not null)
            {
                var propertyName = string.IsNullOrWhiteSpace(property.Name.En) ? property.Name.Ar : property.Name.En;
                var hostBookingLink = $"/host/bookings/{booking.Id}";

                // Notify host: payment confirmed
                var hostMessage = $"{guestFullName} completed payment for \"{propertyName}\". The booking is now fully confirmed.";
                await _notificationService.CreateNotificationAsync(new Domain.Entities.Notification(
                    property.HostId.ToString(),
                    "Payment Confirmed – Booking Secure",
                    hostMessage,
                    hostBookingLink));

                await _hubContext.Clients.User(property.HostId.ToString())
                    .SendAsync("ReceiveNotification", new
                    {
                        BookingId = booking.Id,
                        Title = "Payment Confirmed – Booking Secure",
                        Message = hostMessage,
                        TargetLink = hostBookingLink
                    });

                // Notify guest: payment success
                var guestReceiptLink = $"/receipt/{booking.Id}";
                var guestMessage = $"Your payment for \"{propertyName}\" was received. Your stay is now confirmed!";
                await _notificationService.CreateNotificationAsync(new Domain.Entities.Notification(
                    booking.GuestId.ToString(),
                    "Payment Successful – Booking Confirmed!",
                    guestMessage,
                    guestReceiptLink));

                await _hubContext.Clients.User(booking.GuestId.ToString())
                    .SendAsync("ReceiveNotification", new
                    {
                        BookingId = booking.Id,
                        Title = "Payment Successful – Booking Confirmed!",
                        Message = guestMessage,
                        TargetLink = guestReceiptLink
                    });
            }

            if (guest is not null && !string.IsNullOrWhiteSpace(guest.Email))
            {
                var fullName = string.Join(" ", new[] { guest.FirstName, guest.LastName }.Where(x => !string.IsNullOrWhiteSpace(x))).Trim();
                _backgroundJobClient.Enqueue<IEmailService>(x => x.SendEmailAsync(
                    guest.Email,
                    string.IsNullOrWhiteSpace(fullName) ? "Guest" : fullName,
                    "d-xxx-receipt-template",
                    new { bookingId = booking.Id.ToString(), amount = booking.TotalPrice.Amount, currency = booking.TotalPrice.Currency }));
            }
        }
        else
        {
            booking.MarkPaymentFailed();
        }

        await _dbContext.SaveChangesAsync();
    }
}
