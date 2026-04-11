using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalsPlatform.Application.DTOs.Bookings;
using RentalsPlatform.Application.Services;

namespace RentalsPlatform.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BookingsController : ControllerBase
{
    private readonly IBookingService _bookingService;

    public BookingsController(IBookingService bookingService)
    {
        _bookingService = bookingService;
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateBookingRequest request, CancellationToken cancellationToken)
    {
        var guestIdRaw = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(guestIdRaw, out var guestId))
            return Unauthorized();

        if (request.CheckOutDate <= request.CheckInDate)
            return BadRequest(new { Message = "Check-out date must be after check-in date." });

        try
        {
            var bookingId = await _bookingService.CreateGuestBookingAsync(
                request.PropertyId,
                guestId,
                request.CheckInDate,
                request.CheckOutDate,
                cancellationToken);

            return Ok(new { Id = bookingId });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpGet("quote")]
    public async Task<IActionResult> Quote([FromQuery] Guid propertyId, [FromQuery] DateOnly checkInDate, [FromQuery] DateOnly checkOutDate, CancellationToken cancellationToken)
    {
        if (checkOutDate <= checkInDate)
            return BadRequest(new { Message = "Check-out date must be after check-in date." });

        try
        {
            var totalAmount = await _bookingService.CalculateGuestBookingTotalAsync(
                propertyId,
                checkInDate,
                checkOutDate,
                cancellationToken);

            return Ok(new { TotalAmount = totalAmount });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [Authorize(Roles = "Host")]
    [HttpPost("block-dates")]
    public async Task<IActionResult> BlockDates([FromBody] BlockDatesDto dto, CancellationToken cancellationToken)
    {
        try
        {
            await _bookingService.BlockDatesAsync(dto, cancellationToken);
            return Ok(new { Message = "Dates blocked successfully." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [Authorize]
    [HttpGet("my-bookings")]
    public async Task<IActionResult> MyBookings(CancellationToken cancellationToken)
    {
        var guestIdRaw = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(guestIdRaw, out var guestId))
            return Unauthorized();

        var bookings = await _bookingService.GetGuestBookingsAsync(guestId, cancellationToken);
        return Ok(bookings);
    }

    /// <summary>Guest cancels their own Pending or Approved booking.</summary>
    [Authorize]
    [HttpDelete("{id:guid}/cancel")]
    public async Task<IActionResult> CancelBooking(Guid id)
    {
        var guestIdRaw = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(guestIdRaw, out var guestId))
            return Unauthorized();

        var result = await _bookingService.CancelGuestBookingAsync(id, guestId);
        if (!result.IsSuccess)
            return BadRequest(new { result.Message });

        return Ok(new { result.Message });
    }

    public sealed record CreateBookingRequest(Guid PropertyId, DateOnly CheckInDate, DateOnly CheckOutDate);
}

