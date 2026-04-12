using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using RentalsPlatform.Application.DTOs.Payments;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Infrastructure.Services;

namespace RentalsPlatform.Api.Controllers;

[ApiController]
[Route("api/payments")]
public class PaymentsController : ControllerBase
{
    private readonly IPaymobService _paymobService;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ILogger<PaymentsController> _logger;

    public PaymentsController(
        IPaymobService paymobService,
        UserManager<ApplicationUser> userManager,
        ILogger<PaymentsController> logger)
    {
        _paymobService = paymobService;
        _userManager = userManager;
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
}
