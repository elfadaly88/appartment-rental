using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalsPlatform.Application.DTOs.Reviews;
using RentalsPlatform.Application.Services;

namespace RentalsPlatform.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReviewsController : ControllerBase
{
    private readonly IReviewService _reviewService;

    public ReviewsController(IReviewService reviewService)
    {
        _reviewService = reviewService;
    }

    [HttpPost]
    [Authorize(Roles = "Guest")]
    public async Task<IActionResult> SubmitReview([FromBody] SubmitReviewDto model)
    {
        var guestId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(guestId))
            return Unauthorized();

        var result = await _reviewService.SubmitReviewAsync(guestId, model);
        if (!result.IsSuccess)
            return BadRequest(new { result.Message });

        return Ok(new { result.Message });
    }

    [HttpGet("host/properties/{propertyId:guid}")]
    [Authorize(Roles = "Host")]
    public async Task<IActionResult> GetHostPropertyReviews(Guid propertyId)
    {
        var hostId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(hostId))
            return Unauthorized();

        var stats = await _reviewService.GetHostPropertyReviewsAsync(hostId, propertyId);
        return Ok(stats);
    }
}
