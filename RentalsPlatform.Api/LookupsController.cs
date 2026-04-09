using Microsoft.AspNetCore.Mvc;
using RentalsPlatform.Infrastructure.Services;

namespace RentalsPlatform.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LookupsController : ControllerBase
{
    private readonly ILookupService _lookupService;

    public LookupsController(ILookupService lookupService)
    {
        _lookupService = lookupService;
    }

    [HttpGet("egypt-locations")]
    public async Task<IActionResult> GetEgyptLocations()
    {
        var result = await _lookupService.GetEgyptGovernoratesWithCitiesAsync();
        return Ok(result);
    }
}
