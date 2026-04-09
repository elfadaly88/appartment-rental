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
}
