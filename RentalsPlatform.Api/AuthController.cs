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

    // تسجل مستخدم عادي (Guest)
    [HttpPost("register/guest")]
    public async Task<IActionResult> RegisterGuest([FromBody] RegisterDto dto)
    {
        var result = await _authService.RegisterGuestAsync(dto);

        if (!result.IsSuccess)
            return BadRequest(result);

        return Ok(result);
    }

    // تسجيل مضيف (Host)
    [HttpPost("register/host")]
    public async Task<IActionResult> RegisterHost([FromBody] RegisterDto dto)
    {
        var result = await _authService.RegisterHostAsync(dto);

        if (!result.IsSuccess)
            return BadRequest(result);

        return Ok(result);
    }

    // تسجيل الدخول العادي (Email/Password)
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto model)
    {
        var result = await _authService.LoginAsync(model);

        if (!result.IsSuccess)
        {
            // نبعت الـ result كامل عشان الأنجيولار يقرأ الـ Errors براحته
            return BadRequest(result);
        }

        return Ok(result);
    }

    // نقطة الربط مع جوجل وفيسبوك
    [HttpPost("external-login/callback")]
    public async Task<IActionResult> ExternalLoginCallback([FromBody] ExternalLoginDto dto)
    {
        // الـ dto ده شايل الـ IdToken لجوجل أو الـ AccessToken لفيسبوك
        var result = await _authService.ExternalLoginAsync(dto);

        if (!result.IsSuccess)
        {
            return BadRequest(result);
        }

        // في حالة النجاح، بيرجع الـ AuthResult شايل الـ JWT Token وبيانات اليوزر
        return Ok(result);
    }
}