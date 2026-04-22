using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Application.DTOs.Public;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Domain.Enums;
using RentalsPlatform.Infrastructure.Data;

namespace RentalsPlatform.Api.Controllers;

/// <summary>
/// Publicly accessible data endpoints — no authentication required.
/// </summary>
[ApiController]
[Route("api/public")]
[AllowAnonymous]
public sealed class PublicDataController : ControllerBase
{
    private readonly ApplicationDbContext        _db;
    private readonly UserManager<ApplicationUser> _userManager;

    public PublicDataController(ApplicationDbContext db, UserManager<ApplicationUser> userManager)
    {
        _db          = db;
        _userManager = userManager;
    }

    /// <summary>
    /// Returns aggregate statistics shown on the public landing page.
    /// </summary>
    [HttpGet("landing-stats")]
    [ResponseCache(Duration = 300, Location = ResponseCacheLocation.Any, VaryByHeader = "Origin")]
    public async Task<ActionResult<LandingStatsDto>> GetLandingStats()
    {
        var currentYear = DateTime.UtcNow.Year;

        var luxuryUnits = await _db.Properties
            .AsNoTracking()
            .CountAsync(p => p.Status == PropertyStatus.Approved);

        var totalClients = await _userManager.Users.CountAsync();

        var annualTransactions = await _db.Bookings
            .AsNoTracking()
            .CountAsync(b =>
                b.Status == BookingStatus.Completed &&
                b.EndDate.Year == currentYear);

        return Ok(new LandingStatsDto
        {
            LuxuryUnits        = luxuryUnits,
            TotalClients       = totalClients,
            AnnualTransactions = annualTransactions,
            CurrentYear        = currentYear.ToString()
        });
    }

    /// <summary>
    /// Returns paginated featured (approved) properties with optional city filter.
    /// </summary>
    [HttpGet("properties")]
    [ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any, VaryByQueryKeys = new[] { "city", "page", "pageSize" })]
    public async Task<ActionResult<FeaturedPropertiesResultDto>> GetFeaturedProperties(
        [FromQuery] string? city,
        [FromQuery] int page     = 1,
        [FromQuery] int pageSize = 12)
    {
        pageSize = Math.Clamp(pageSize, 1, 48);
        page     = Math.Max(1, page);

        var query = _db.Properties
            .AsNoTracking()
            .Where(p => p.Status == PropertyStatus.Approved);

        if (!string.IsNullOrWhiteSpace(city))
            query = query.Where(p => p.Location.City == city);

        var totalCount = await query.CountAsync();

        var cities = await _db.Properties
            .AsNoTracking()
            .Where(p => p.Status == PropertyStatus.Approved)
            .Select(p => p.Location.City)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync();

        var items = await query
            .OrderByDescending(p => p.SubmittedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new FeaturedPropertyDto(
                p.Id,
                p.Name.En ?? p.Name.Ar ?? string.Empty,
                p.Location.City,
                p.Location.Country,
                p.PricePerNight.Amount,
                p.PricePerNight.Currency,
                //p.PropertyImages.Where(i => i.IsThumbnail).Select(i => i.Url).FirstOrDefault(),
                p.PropertyImages.Select(i => i.Url).FirstOrDefault(),
                p.MaxGuests))
            .ToListAsync();

        return Ok(new FeaturedPropertiesResultDto(items, totalCount, page, pageSize, cities));
    }
}
