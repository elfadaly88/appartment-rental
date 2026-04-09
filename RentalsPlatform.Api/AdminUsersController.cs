using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalsPlatform.Application.DTOs.Admin;
using RentalsPlatform.Application.Services;

namespace RentalsPlatform.Api.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin")]
public class AdminUsersController : ControllerBase
{
    private readonly IAdminUserService _adminUserService;

    public AdminUsersController(IAdminUserService adminUserService)
    {
        _adminUserService = adminUserService;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers([FromQuery] string? roleFilter = null)
    {
        var users = await _adminUserService.GetUsersAsync(roleFilter);
        return Ok(users);
    }

    [HttpPatch("{id}/ban")]
    public async Task<IActionResult> BanUser(string id, [FromBody] BanUserRequestDto request)
    {
        var result = await _adminUserService.BanUserAsync(id, request.Reason);
        if (!result.IsSuccess)
            return BadRequest(new { result.Message });

        return Ok(new { result.Message });
    }

    [HttpPatch("{id}/unban")]
    public async Task<IActionResult> UnbanUser(string id)
    {
        var result = await _adminUserService.UnbanUserAsync(id);
        if (!result.IsSuccess)
            return BadRequest(new { result.Message });

        return Ok(new { result.Message });
    }
}
