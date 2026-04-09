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

    public CalendarController(IAvailabilityService availabilityService, IHostCalendarService hostCalendarService)
    {
        _availabilityService = availabilityService;
        _hostCalendarService = hostCalendarService;
    }

    [HttpGet("properties/{id:guid}/availability")]
    public async Task<IActionResult> GetPropertyAvailability(Guid id, CancellationToken cancellationToken)
    {
        var takenDates = await _availabilityService.GetTakenDatesAsync(id, cancellationToken);
        return Ok(takenDates);
    }

    [Authorize(Roles = "Host")]
    [HttpPost("host/block-dates")]
    public async Task<IActionResult> BlockDates([FromBody] BlockDto dto, CancellationToken cancellationToken)
    {
        try
        {
            await _hostCalendarService.BlockDatesAsync(dto, cancellationToken);
            return Ok(new { Message = "Dates blocked successfully." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }
}
