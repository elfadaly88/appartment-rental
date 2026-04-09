using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalsPlatform.Application.DTOs.Admin;
using RentalsPlatform.Application.Services;

namespace RentalsPlatform.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly IAdminService _adminService;

    public AdminController(IAdminService adminService)
    {
        _adminService = adminService;
    }

    [HttpGet("properties/pending")]
    public async Task<IActionResult> GetPendingProperties()
    {
        var properties = await _adminService.GetPendingPropertiesAsync();
        return Ok(properties);
    }

    [HttpPatch("properties/{id:guid}/approve")]
    public async Task<IActionResult> ApproveProperty(Guid id)
    {
        var result = await _adminService.ApprovePropertyAsync(id);
        if (!result.IsSuccess)
            return BadRequest(new { result.Message });

        return Ok(new { result.Message });
    }

    [HttpPatch("properties/{id:guid}/reject")]
    public async Task<IActionResult> RejectProperty(Guid id, [FromBody] RejectPropertyRequestDto request)
    {
        var result = await _adminService.RejectPropertyAsync(id, request.Reason);
        if (!result.IsSuccess)
            return BadRequest(new { result.Message });

        return Ok(new { result.Message });
    }
}
