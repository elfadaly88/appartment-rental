using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalsPlatform.Application.Services;

namespace RentalsPlatform.Api.Controllers;

[ApiController]
[Route("api/admin/dashboard")]
[Authorize(Roles = "Admin")]
public class AdminDashboardController : ControllerBase
{
    private readonly IAdminAnalyticsService _adminAnalyticsService;

    public AdminDashboardController(IAdminAnalyticsService adminAnalyticsService)
    {
        _adminAnalyticsService = adminAnalyticsService;
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var stats = await _adminAnalyticsService.GetMasterStatsAsync();
        return Ok(stats);
    }
}
