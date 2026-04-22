using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using RentalsPlatform.Application.Common;
using RentalsPlatform.Domain.Entities;
using System.Security.Claims;

namespace RentalsPlatform.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RentalsPlatform.Infrastructure.Data.ApplicationDbContext _dbContext;

    public ProfileController(UserManager<ApplicationUser> userManager, RentalsPlatform.Infrastructure.Data.ApplicationDbContext dbContext)
    {
        _userManager = userManager;
        _dbContext = dbContext;
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetProfile()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound("User not found");

        return Ok(new
        {
            user.Email,
            user.DisplayName,
            user.Bio,
            PhoneNumber = user.PhoneNumber,
            AvatarUrl = user.AvatarUrl ?? user.ProfilePictureUrl,
            user.JoinedDate
        });
    }

    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicProfile(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound("User not found");

        var roles = await _userManager.GetRolesAsync(user);
        double? averageRating = null;

        if (roles.Contains("host", StringComparer.OrdinalIgnoreCase) && Guid.TryParse(id, out var hostGuid))
        {
            // Average rating across all properties this user hosts
            var ratingQuery = from property in _dbContext.Properties
                              where property.HostId == hostGuid
                              join review in _dbContext.Reviews on property.Id equals review.PropertyId
                              select review.Rating;

            if (ratingQuery.Any())
            {
                averageRating = ratingQuery.Average();
            }
        }

        return Ok(new
        {
            Id = id,
            DisplayName = user.DisplayName,
            Bio = user.Bio,
            AvatarUrl = user.AvatarUrl ?? user.ProfilePictureUrl,
            JoinedDate = user.JoinedDate,
            Roles = roles,
            AverageRating = averageRating
        });
    }

    [HttpPut]
    public async Task<IActionResult> UpdateProfile([FromForm] ProfileUpdateDto request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound("User not found");

        // Update fields securely
        if (!string.IsNullOrWhiteSpace(request.DisplayName))
        {
            user.DisplayName = request.DisplayName;
        }

        user.Bio = request.Bio;

        if (!string.IsNullOrWhiteSpace(request.PhoneNumber))
        {
            var normalizedPhone = EgyptianPhoneNumber.NormalizeToLocal(request.PhoneNumber);
            if (!EgyptianPhoneNumber.IsValidLocal(normalizedPhone))
                return BadRequest(new { Message = "Please enter a valid Egyptian mobile number (e.g., 010xxxxxxxx)." });

            user.PhoneNumber = normalizedPhone;
        }

        if (request.Avatar != null)
        {
            // Validate file size (max 2MB)
            if (request.Avatar.Length > 2 * 1024 * 1024)
            {
                return BadRequest("Avatar file size exceeds 2MB.");
            }

            // Simulate cloud upload and get URL (replace with actual Azure/Firebase logic)
            // Example: var avatarUrl = await _cloudStorageService.UploadFileAsync(request.Avatar);
            using var ms = new MemoryStream();
            await request.Avatar.CopyToAsync(ms);
            var fileBytes = ms.ToArray();
            var base64 = Convert.ToBase64String(fileBytes);

            // In a real scenario, this would be a URL representing the uploaded file
            user.AvatarUrl = $"data:{request.Avatar.ContentType};base64,{base64}";
        }

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors);
        }

        return Ok(new
        {
            user.DisplayName,
            user.Bio,
            PhoneNumber = user.PhoneNumber,
            user.AvatarUrl,
            user.JoinedDate
        });
    }
}

public class ProfileUpdateDto
{
    [System.ComponentModel.DataAnnotations.MaxLength(100, ErrorMessage = "Display Name cannot exceed 100 characters.")]
    public string? DisplayName { get; set; }

    [System.ComponentModel.DataAnnotations.MaxLength(500, ErrorMessage = "Bio cannot exceed 500 characters.")]
    public string? Bio { get; set; }

    [System.ComponentModel.DataAnnotations.MaxLength(20, ErrorMessage = "Phone number cannot exceed 20 characters.")]
    public string? PhoneNumber { get; set; }

    public IFormFile? Avatar { get; set; }
}
