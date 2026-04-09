using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalsPlatform.Application.Services;

namespace RentalsPlatform.Api.Controllers;

[ApiController]
[Route("api/host/bookings")]
[Authorize(Roles = "Host")]
public class HostBookingsController : ControllerBase
{
    private readonly IBookingService _bookingService;

    public HostBookingsController(IBookingService bookingService)
    {
        _bookingService = bookingService;
    }

    [HttpGet]
    public async Task<IActionResult> GetHostBookings()
    {
        var hostId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(hostId))
            return Unauthorized();

        var bookings = await _bookingService.GetHostBookingsAsync(hostId);
        return Ok(bookings);
    }

    [HttpPatch("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id)
    {
        var hostId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(hostId))
            return Unauthorized();

        var result = await _bookingService.ApproveBookingAsync(id, hostId);
        if (!result.IsSuccess)
            return BadRequest(new { result.Message });

        return Ok(new { result.Message });
    }

    [HttpPatch("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id)
    {
        var hostId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(hostId))
            return Unauthorized();

        var result = await _bookingService.RejectBookingAsync(id, hostId);
        if (!result.IsSuccess)
            return BadRequest(new { result.Message });

        return Ok(new { result.Message });
    }
}
