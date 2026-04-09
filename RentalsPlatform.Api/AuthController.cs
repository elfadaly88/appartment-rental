using Microsoft.AspNetCore.Mvc;
using RentalsPlatform.Application.DTOs.Auth;
using RentalsPlatform.Application.Services;

namespace RentalsPlatform.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("register/guest")]
    public async Task<IActionResult> RegisterGuest([FromBody] RegisterDto dto)
    {
        var result = await _authService.RegisterGuestAsync(dto);
        if (!result.IsSuccess)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPost("register/host")]
    public async Task<IActionResult> RegisterHost([FromBody] RegisterDto dto)
    {
        var result = await _authService.RegisterHostAsync(dto);
        if (!result.IsSuccess)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto model)
    {
        var result = await _authService.LoginAsync(model);

        if (result.IsSuccess)
        {
            // ✅ بنبعث الـ result نفسه للأنجولار لأنه شايل كل حاجة
            return Ok(result);
        }

        return BadRequest(new { message = result.Message, errors = result.Errors });
    }
}