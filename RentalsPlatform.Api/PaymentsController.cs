using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Application.DTOs.Payments;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Domain.Enums;
using RentalsPlatform.Infrastructure.Data;
using RentalsPlatform.Infrastructure.Services;

namespace RentalsPlatform.Api.Controllers;

[ApiController]
[Route("api/payments")]
public class PaymentsController : ControllerBase
{
    private readonly IPaymobService _paymobService;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<PaymentsController> _logger;

    public PaymentsController(
        IPaymobService paymobService,
        UserManager<ApplicationUser> userManager,
        ApplicationDbContext dbContext,
        ILogger<PaymentsController> logger)
    {
        _paymobService = paymobService;
        _userManager = userManager;
        _dbContext = dbContext;
        _logger = logger;
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
    [Authorize]
    [HttpPost("paymob/initiate")]
    public async Task<IActionResult> InitiatePayment([FromBody] InitiatePaymentRequest request)
    {
        if (request.BookingId == Guid.Empty)
            return BadRequest(new { Message = "Booking id is required." });

        try
        {
            var response = await _paymobService.InitializeBookingPaymentAsync(request.BookingId);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Unable to initiate payment for booking {BookingId}", request.BookingId);
            return BadRequest(new { Message = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Paymob API error for booking {BookingId}: {StatusCode}", request.BookingId, ex.StatusCode);
            return StatusCode(StatusCodes.Status502BadGateway, new { Message = "Payment provider returned an error. Please try again later.", Detail = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error initiating payment for booking {BookingId}", request.BookingId);
            return StatusCode(StatusCodes.Status500InternalServerError, new { Message = "Could not initialize payment with Paymob.", Detail = ex.Message });
        }
    }

    [Authorize]
    [HttpGet("paymob/payment-status/{bookingId:guid}")]
    public async Task<IActionResult> GetPaymentStatus(Guid bookingId)
    {
        var userIdRaw = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdRaw, out var userId))
            return Unauthorized();

        var booking = await _dbContext.Bookings
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == bookingId && b.GuestId == userId);

        if (booking is null)
            return NotFound(new { Message = "Booking not found." });

        var paymentStatus = await _paymobService.GetBookingPaymentStatusAsync(bookingId);

        return Ok(new
        {
            bookingId,
            paymentStatus = paymentStatus.ToString(),
            isPaid = paymentStatus == PaymentStatus.Paid
        });
    }

    public sealed record InitiatePaymentRequest(Guid BookingId);
}
