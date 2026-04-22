using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Application.Common;
using RentalsPlatform.Application.DTOs.Bookings;
using RentalsPlatform.Application.Services;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Domain.Enums;
using RentalsPlatform.Infrastructure.Data;

namespace RentalsPlatform.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BookingsController : ControllerBase
{
    private readonly IBookingService _bookingService;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _dbContext;

    public BookingsController(
        IBookingService bookingService,
        UserManager<ApplicationUser> userManager,
        ApplicationDbContext dbContext)
    {
        _bookingService = bookingService;
        _userManager = userManager;
        _dbContext = dbContext;
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateBookingRequest request, CancellationToken cancellationToken)
    {
        var guestIdRaw = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(guestIdRaw, out var guestId))
            return Unauthorized();

        var guest = await _userManager.FindByIdAsync(guestId.ToString());
        if (guest is null)
            return Unauthorized();

        if (!EgyptianPhoneNumber.IsValidLocal(guest.PhoneNumber))
            return BadRequest(new { Message = "Mobile number is required for payment security. Please update your profile before booking." });

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

    /// <summary>
    /// Verifies the booking payment state from DB after UI callback.
    /// NOTE: callback success query param is only a hint and never trusted for final confirmation.
    /// </summary>
    [Authorize]
    [HttpPost("verify-payment-status")]
    public async Task<IActionResult> VerifyPaymentStatus([FromBody] VerifyBookingPaymentRequest request, CancellationToken cancellationToken)
    {
        if (request.BookingId == Guid.Empty)
            return BadRequest(new { Message = "Booking id is required." });

        var guestIdRaw = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(guestIdRaw, out var guestId))
            return Unauthorized();

        var booking = await _dbContext.Bookings
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == request.BookingId && b.GuestId == guestId, cancellationToken);

        if (booking is null)
            return NotFound(new { Message = "Booking not found." });

        var isPaid = booking.PaymentStatus == PaymentStatus.Paid;
        var isConfirmed = booking.Status == BookingStatus.Confirmed;

        return Ok(new
        {
            bookingId = booking.Id,
            status = booking.Status.ToString(),
            paymentStatus = booking.PaymentStatus.ToString(),
            paymentId = booking.PaymobOrderId,
            callbackSuccessHint = request.Success,
            isVerified = isPaid && isConfirmed
        });
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
    public sealed record VerifyBookingPaymentRequest(Guid BookingId, bool Success);
}

