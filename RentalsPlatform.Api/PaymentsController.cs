using System.Security.Claims;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RentalsPlatform.Application.DTOs.Payments;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Domain.Enums;
using RentalsPlatform.Infrastructure.Data;
using RentalsPlatform.Infrastructure.Services;

namespace RentalsPlatform.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly IPaymobService _paymobService;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _dbContext;
    private readonly PaymobSettings _paymobSettings;
    private readonly ILogger<PaymentsController> _logger;

    public PaymentsController(
        IPaymobService paymobService,
        UserManager<ApplicationUser> userManager,
        ApplicationDbContext dbContext,
        IOptions<PaymobSettings> paymobSettings,
        ILogger<PaymentsController> logger)
    {
        _paymobService = paymobService;
        _userManager = userManager;
        _dbContext = dbContext;
        _paymobSettings = paymobSettings.Value;
        _logger = logger;
    }

    [Authorize]
[HttpPost("paymob/initiate")]
public async Task<IActionResult> InitiatePaymob([FromBody] InitiatePaymobRequestDto request, CancellationToken cancellationToken)
{
    if (request.BookingId == Guid.Empty)
        return BadRequest(new { Message = "BookingId is required." });

    var guestIdRaw = User.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!Guid.TryParse(guestIdRaw, out var guestId))
        return Unauthorized();

    // السطر ده بنشيله لأننا مش محتاجين IframeId في الـ Unified Checkout
    if (string.IsNullOrWhiteSpace(_paymobSettings.ApiKey))
        return StatusCode(StatusCodes.Status500InternalServerError, new { Message = "Paymob ApiKey is not configured." });

    var booking = await _dbContext.Bookings
        .FirstOrDefaultAsync(b => b.Id == request.BookingId && b.GuestId == guestId, cancellationToken);

    if (booking is null)
        return NotFound(new { Message = "Booking not found." });

    var guest = await _userManager.FindByIdAsync(guestId.ToString());
    if (guest is null) return NotFound();

    try
    {
        // 1. حساب المبلغ بالقروش
        var amountCents = (long)(booking.TotalPrice.Amount * 100);

        // 2. تجهيز بيانات الـ Intention
        // ملاحظة: هنا بنستخدم API الـ Intention الجديد
        var intentionData = new
        {
            amount = amountCents,
            currency = booking.TotalPrice.Currency, // "EGP"
            payment_methods = new[] { _paymobSettings.IntegrationId }, // 4028437
            items = new[] {
                new { name = "Booking Rental", amount = amountCents, description = $"Booking for {booking.Id}" }
            },
            billing_data = new
            {
                first_name = string.IsNullOrWhiteSpace(guest.FirstName) ? "Guest" : guest.FirstName,
                last_name = string.IsNullOrWhiteSpace(guest.LastName) ? "User" : guest.LastName,
                email = guest.Email,
                phone_number = string.IsNullOrWhiteSpace(guest.PhoneNumber) ? "01000000000" : guest.PhoneNumber,
                apartment = "NA", floor = "NA", street = "NA", building = "NA", city = "Cairo", country = "Egypt"
            },
            extras = new { booking_id = booking.Id }
        };

        // 3. نكلم باي موب (Unified Checkout API)
        using var client = new HttpClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Token", _paymobSettings.SecretKey); // استخدم الـ Secret Key هنا

        var response = await client.PostAsJsonAsync("https://api.paymob.com/v1/intention/", intentionData);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            _logger.LogError("Paymob Intention Failed: {Error}", error);
            return BadRequest(new { Message = "فشل في التواصل مع بوابة الدفع" });
        }

        var result = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        if (!result.TryGetProperty("client_secret", out var clientSecretElement))
        {
            _logger.LogError("Paymob Intention response did not include client_secret.");
            return StatusCode(StatusCodes.Status502BadGateway, new { Message = "Invalid payment provider response." });
        }

        var clientSecret = clientSecretElement.GetString();
        if (string.IsNullOrWhiteSpace(clientSecret))
        {
            _logger.LogError("Paymob Intention response included empty client_secret.");
            return StatusCode(StatusCodes.Status502BadGateway, new { Message = "Invalid payment provider response." });
        }

        // 4. نرجع الـ Client Secret للـ Frontend
        return Ok(new
        {
            BookingId = booking.Id,
            ClientSecret = clientSecret,
            PublicKey = _paymobSettings.PublicKey // محتاجينه في الـ Frontend
        });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "General Payment Error");
        return StatusCode(500, "حدث خطأ غير متوقع");
    }
}

    [Authorize(Roles = "Host")]
    [HttpPost("host/bank-details")]
    public async Task<IActionResult> SaveHostBankDetails([FromBody] HostBankDetailsDto request)
    {
        var hostId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(hostId))
            return Unauthorized();

        var host = await _userManager.FindByIdAsync(hostId);
        if (host is null)
            return NotFound(new { Message = "Host account not found." });

        try
        {
            var authToken = await _paymobService.GetAuthTokenAsync();
            var subMerchantId = await _paymobService.CreateSubMerchantAsync(authToken, request);

            host.PaymobSubMerchantId = subMerchantId;
            host.BankAccountNumber = request.BankAccountNumber;

            var updateResult = await _userManager.UpdateAsync(host);
            if (!updateResult.Succeeded)
            {
                return BadRequest(new
                {
                    Message = "Failed to save host payout details.",
                    Errors = updateResult.Errors.Select(e => e.Description)
                });
            }

            return Ok(new { Message = "Host payout profile configured successfully.", SubMerchantId = subMerchantId });
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Paymob onboarding HTTP error for host {HostId}", hostId);
            return StatusCode(StatusCodes.Status502BadGateway, new { Message = "Payment provider is unavailable. Please try again later." });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogError(ex, "Paymob onboarding error for host {HostId}", hostId);
            return BadRequest(new { Message = ex.Message });
        }
    }
}
