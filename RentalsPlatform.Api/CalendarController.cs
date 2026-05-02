using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalsPlatform.Application.DTOs.Calendar;
using RentalsPlatform.Application.Services;

namespace RentalsPlatform.Api.Controllers;

[ApiController]
[Route("api/calendar")]
public class CalendarController : ControllerBase
{
    private readonly IAvailabilityService _availabilityService;
    private readonly IHostCalendarService _hostCalendarService;
    private readonly IPricingService _pricingService;

    public CalendarController(
        IAvailabilityService availabilityService,
        IHostCalendarService hostCalendarService,
        IPricingService pricingService)
    {
        _availabilityService = availabilityService;
        _hostCalendarService = hostCalendarService;
        _pricingService = pricingService;
    }

    // ── Guest: flat list of taken dates (legacy / backward compat) ───────
    [HttpGet("properties/{id:guid}/availability")]
    public async Task<IActionResult> GetPropertyAvailability(Guid id, CancellationToken cancellationToken)
    {
        var takenDates = await _availabilityService.GetTakenDatesAsync(id, cancellationToken);
        return Ok(takenDates);
    }

    // ── Guest: typed calendar entries (blocked + booked + seasonal) ──────
    [HttpGet("properties/{id:guid}/entries")]
    public async Task<IActionResult> GetCalendarEntries(
        Guid id,
        [FromQuery] DateOnly startDate,
        [FromQuery] DateOnly endDate,
        CancellationToken cancellationToken)
    {
        if (startDate >= endDate)
            return BadRequest(new { Message = "End date must be after start date." });

        var entries = await _availabilityService.GetCalendarEntriesAsync(id, startDate, endDate, cancellationToken);
        return Ok(entries);
    }

    // ── Guest: price breakdown + availability check ───────────────────────
    /// <summary>
    /// Returns a detailed night-by-night quote for a date range.
    /// Includes availability status (blocked dates check) and seasonal pricing breakdown.
    /// </summary>
    [HttpGet("properties/{id:guid}/quote")]
    public async Task<IActionResult> Quote(
        Guid id,
        [FromQuery] DateOnly checkIn,
        [FromQuery] DateOnly checkOut,
        CancellationToken cancellationToken)
    {
        if (checkOut <= checkIn)
            return BadRequest(new { Message = "Check-out date must be after check-in date." });

        var quote = await _pricingService.GetBreakdownAsync(id, checkIn, checkOut, cancellationToken);
        return Ok(quote);
    }

    // ── Host: block dates (legacy endpoint — kept for backward compat) ───
    [Authorize(Roles = "Host")]
    [HttpPost("host/block-dates")]
    public async Task<IActionResult> BlockDates([FromBody] BlockDto dto, CancellationToken cancellationToken)
    {
        try
        {
            var blockId = await _hostCalendarService.BlockDatesAsync(dto, cancellationToken);
            return Ok(new { Message = "Dates blocked successfully.", BlockId = blockId });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }
}

