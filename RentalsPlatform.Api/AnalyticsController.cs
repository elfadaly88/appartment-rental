using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalsPlatform.Application.Services;
using RentalsPlatform.Infrastructure.Services;

namespace RentalsPlatform.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Host")]
public class AnalyticsController : ControllerBase
{
    private readonly IAnalyticsService _analyticsService;
    private readonly IReportService _reportService;

    public AnalyticsController(IAnalyticsService analyticsService, IReportService reportService)
    {
        _analyticsService = analyticsService;
        _reportService = reportService;
    }

    [HttpGet("dashboard-stats")]
    public async Task<IActionResult> GetDashboardStats([FromQuery] int? year = null)
    {
        var hostId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(hostId))
        {
            return Unauthorized();
        }

        var targetYear = year ?? DateTime.UtcNow.Year;
        var result = await _analyticsService.GetHostDashboardStatsAsync(hostId, targetYear);
        return Ok(result);
    }

    [HttpGet("export/excel")]
    public async Task<IActionResult> ExportExcel([FromQuery] int? year = null)
    {
        var hostId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(hostId))
        {
            return Unauthorized();
        }

        var targetYear = year ?? DateTime.UtcNow.Year;
        var data = await _analyticsService.GetHostDashboardStatsAsync(hostId, targetYear);
        var fileBytes = await _reportService.GenerateExcelReportAsync(data);

        return File(
            fileBytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "HostReport.xlsx");
    }

    [HttpGet("export/pdf")]
    public async Task<IActionResult> ExportPdf([FromQuery] int? year = null)
    {
        var hostId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(hostId))
        {
            return Unauthorized();
        }

        var targetYear = year ?? DateTime.UtcNow.Year;
        var data = await _analyticsService.GetHostDashboardStatsAsync(hostId, targetYear);
        var fileBytes = await _reportService.GeneratePdfReportAsync(data);

        return File(fileBytes, "application/pdf", "HostReport.pdf");
    }
}
