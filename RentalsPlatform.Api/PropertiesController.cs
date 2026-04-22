using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using RentalsPlatform.Application.Common;
using RentalsPlatform.Application.DTOs.Properties;
using RentalsPlatform.Application.Interfaces;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Domain.Enums;
using RentalsPlatform.Domain.ValueObjects;
using RentalsPlatform.Infrastructure.Data;
using RentalsPlatform.Infrastructure.Services;
using RentalsPlatform.Infrastructure.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Identity;

namespace RentalsPlatform.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PropertiesController(
    ICloudStorageService cloudStorageService,
    IPropertyRepository propertyRepository,
    ApplicationDbContext dbContext,
    IHubContext<NotificationHub> notificationHub,
    UserManager<ApplicationUser> userManager) : BaseController
{
    [HttpGet]
    public async Task<IActionResult> GetProperties(CancellationToken cancellationToken)
    {
        var properties = await propertyRepository.GetAllAsync(cancellationToken);

        var response = properties.Select(p => new
        {
            p.Id,
            Title = string.IsNullOrWhiteSpace(p.Name.En) ? p.Name.Ar : p.Name.En,
            Description = string.IsNullOrWhiteSpace(p.Description.En) ? p.Description.Ar : p.Description.En,
            Price = p.PricePerNight.Amount,
            Currency = p.PricePerNight.Currency,
            p.MaxGuests
        });

        return Ok(response);
    }

    [HttpGet("search")]
    public async Task<IActionResult> SearchProperties(
        [FromQuery] string? city,
        [FromQuery] DateOnly? checkIn,
        [FromQuery] DateOnly? checkOut,
        [FromQuery] decimal minPrice = 0,
        [FromQuery] decimal maxPrice = 15000,
        [FromQuery] int guests = 1,
        CancellationToken cancellationToken = default)
    {
        if (guests < 1)
            guests = 1;

        if (minPrice < 0)
            minPrice = 0;

        if (maxPrice < minPrice)
            (minPrice, maxPrice) = (maxPrice, minPrice);

        if (checkIn.HasValue && checkOut.HasValue && checkOut.Value <= checkIn.Value)
            return BadRequest(new { Message = "checkOut must be after checkIn." });

        var query = dbContext.Properties
            .AsNoTracking()
            .Where(p => p.Status == PropertyStatus.Approved)
            .Where(p => p.PricePerNight.Amount >= minPrice && p.PricePerNight.Amount <= maxPrice)
            .Where(p => p.MaxGuests >= guests);

        if (!string.IsNullOrWhiteSpace(city))
        {
            var normalizedCity = city.Trim().ToLower();
            query = query.Where(p => p.Location.City.ToLower() == normalizedCity);
        }

        if (checkIn.HasValue && checkOut.HasValue)
        {
            var from = checkIn.Value;
            var to = checkOut.Value;

            query = query
                .Where(p => !dbContext.UnavailableDates
                    .Any(u => u.PropertyId == p.Id && u.StartDate < to && u.EndDate > from))
                .Where(p => !dbContext.Bookings
                    .Any(b => b.PropertyId == p.Id
                        && b.StartDate < to
                        && b.EndDate > from
                        && b.Status != BookingStatus.Cancelled));
        }

        var results = await query
            .OrderBy(p => p.PricePerNight.Amount)
            .Select(p => new
            {
                p.Id,
                Name = new
                {
                    Ar = p.Name.Ar,
                    En = string.IsNullOrWhiteSpace(p.Name.En) ? p.Name.Ar : p.Name.En,
                },
                Address = new
                {
                    Ar = p.Location.City,
                    En = p.Location.City,
                    p.Location.MapUrl,
                },
                Price = new
                {
                    Amount = p.PricePerNight.Amount,
                    Currency = p.PricePerNight.Currency,
                },
                ImageUrl = p.PropertyImages
                    .OrderByDescending(i => i.IsMain)
                    .Select(i => i.Url)
                    .FirstOrDefault() ?? string.Empty,
                Description = new
                {
                    Ar = p.Description.Ar,
                    En = string.IsNullOrWhiteSpace(p.Description.En) ? p.Description.Ar : p.Description.En,
                },
            })
            .ToListAsync(cancellationToken);

        return Ok(results);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetPropertyById(Guid id, CancellationToken cancellationToken)
    {
        // Single query: property + host profile via LEFT JOIN on AspNetUsers
        var result = await (
            from p in dbContext.Properties.AsNoTracking()
                                          .Include(p => p.PropertyImages)
            join u in dbContext.Users.AsNoTracking()
                on p.HostId.ToString() equals u.Id into hostGroup
            from host in hostGroup.DefaultIfEmpty()
            where p.Id == id && p.Status == PropertyStatus.Approved
            select new
            {
                Property = p,
                HostName      = host != null ? (host.FullName ?? host.DisplayName ?? host.Email ?? "") : "",
                HostAvatarUrl = host != null ? (host.AvatarUrl ?? host.ProfilePictureUrl ?? "")        : "",
                HostJoinDate  = host != null ? host.CreatedAt : (DateTime?)null,
            }
        ).FirstOrDefaultAsync(cancellationToken);

        if (result is null)
            return NotFound(new { Message = "Property not found." });

        var property = result.Property;

        // A host is "verified" when they have both a display name and an avatar
        var isVerified = !string.IsNullOrWhiteSpace(result.HostName)
                      && !string.IsNullOrWhiteSpace(result.HostAvatarUrl);

        var response = new
        {
            property.Id,
            Name = new
            {
                Ar = property.Name.Ar,
                En = string.IsNullOrWhiteSpace(property.Name.En) ? property.Name.Ar : property.Name.En,
            },
            Address = new
            {
                Ar = property.Location.City,
                En = property.Location.City,
                property.Location.MapUrl,
                property.Location.Country,
                property.Location.Street,
            },
            Price = new
            {
                Amount   = property.PricePerNight.Amount,
                Currency = property.PricePerNight.Currency,
            },
            Images = property.PropertyImages
                .OrderByDescending(i => i.IsMain)
                .Select(i => i.Url)
                .ToList(),
            Description = new
            {
                Ar = property.Description.Ar,
                En = string.IsNullOrWhiteSpace(property.Description.En)
                     ? property.Description.Ar
                     : property.Description.En,
            },
            property.MaxGuests,
            // ── Host identity card ─────────────────────────────────────
            HostInfo = new
            {
                Name       = string.IsNullOrWhiteSpace(result.HostName) ? "Host" : result.HostName,
                AvatarUrl  = result.HostAvatarUrl,
                JoinedYear = result.HostJoinDate?.Year,
                IsVerified = isVerified,
            },
        };

        return Ok(response);
    }

    [Authorize(Roles = "Host")]
    [HttpGet("host")]
    public async Task<IActionResult> GetHostProperties([FromQuery] Guid? hostId, CancellationToken cancellationToken)
    {
        if (CurrentUserId is not { } currentHostId)
            return Unauthorized(new { Message = "Invalid user token." });

        if (hostId.HasValue && hostId.Value != currentHostId)
            return Forbid();

        var properties = await dbContext.Properties
            .AsNoTracking()
            .Where(p => p.HostId == currentHostId)
            .OrderByDescending(p => p.SubmittedAt)
            .Select(p => new HostPropertySummaryDto(
                p.Id,
                string.IsNullOrWhiteSpace(p.Name.En) ? p.Name.Ar : p.Name.En,
                string.IsNullOrWhiteSpace(p.Description.En) ? p.Description.Ar : p.Description.En,
                p.Location.City,
                p.Location.Country,
                p.PricePerNight.Amount,
                p.PricePerNight.Currency,
                p.MaxGuests,
                p.Status,
                p.PropertyImages.OrderByDescending(i => i.IsMain).Select(i => i.Url).FirstOrDefault(),
                p.RejectionReason,
                p.SubmittedAt))
            .ToListAsync(cancellationToken);

        return Ok(properties);
    }

    [Authorize(Roles = "Host")]
    [HttpGet("host/dashboard")]
    public async Task<IActionResult> GetHostDashboard(CancellationToken cancellationToken)
    {
        if (CurrentUserId is not { } hostId)
            return Unauthorized(new { Message = "Invalid user token." });

        var properties = await dbContext.Properties
            .AsNoTracking()
            .Where(p => p.HostId == hostId)
            .OrderByDescending(p => p.SubmittedAt)
            .Select(p => new HostPropertySummaryDto(
                p.Id,
                string.IsNullOrWhiteSpace(p.Name.En) ? p.Name.Ar : p.Name.En,
                string.IsNullOrWhiteSpace(p.Description.En) ? p.Description.Ar : p.Description.En,
                p.Location.City,
                p.Location.Country,
                p.PricePerNight.Amount,
                p.PricePerNight.Currency,
                p.MaxGuests,
                p.Status,
                p.PropertyImages.OrderByDescending(i => i.IsMain).Select(i => i.Url).FirstOrDefault(),
                p.RejectionReason,
                p.SubmittedAt))
            .ToListAsync(cancellationToken);

        var bookings = await (
            from booking in dbContext.Bookings.AsNoTracking()
            join property in dbContext.Properties.AsNoTracking() on booking.PropertyId equals property.Id
            join guest in dbContext.Users.AsNoTracking() on booking.GuestId.ToString() equals guest.Id into guestGroup
            from guest in guestGroup.DefaultIfEmpty()
            where property.HostId == hostId
            orderby booking.StartDate descending
            select new HostBookingOverviewDto(
                booking.Id,
                property.Id,
                string.IsNullOrWhiteSpace(property.Name.En) ? property.Name.Ar : property.Name.En,
                guest == null
                    ? "Blocked"
                    : string.IsNullOrWhiteSpace((guest.FirstName + " " + guest.LastName).Trim())
                        ? (guest.Email ?? "Guest")
                        : (guest.FirstName + " " + guest.LastName).Trim(),
                booking.StartDate,
                booking.EndDate,
                booking.TotalPrice.Amount,
                booking.TotalPrice.Currency,
                booking.Status,
                booking.PaymentStatus))
            .Take(12)
            .ToListAsync(cancellationToken);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var horizon = today.AddDays(30);
        var activeListings = properties.Count(p => p.Status == PropertyStatus.Approved);
        var totalEarnings = bookings
            .Where(b => b.PaymentStatus == PaymentStatus.Paid && b.Status is BookingStatus.Confirmed or BookingStatus.Completed)
            .Sum(b => b.TotalPrice);
        var projectedIncome = bookings
            .Where(b => b.Status is BookingStatus.Pending or BookingStatus.Confirmed)
            .Sum(b => b.TotalPrice);
        var occupiedNights = bookings
            .Where(b => b.Status is BookingStatus.Confirmed or BookingStatus.Completed)
            .Sum(b => Math.Max(0, Math.Min(b.CheckOutDate.DayNumber, horizon.DayNumber) - Math.Max(b.CheckInDate.DayNumber, today.DayNumber)));
        var occupancyRate = activeListings == 0
            ? 0m
            : Math.Round(occupiedNights / (decimal)(activeListings * 30) * 100m, 2);

        return Ok(new HostDashboardDto(totalEarnings, projectedIncome, activeListings, occupancyRate, properties, bookings));
    }

    [Authorize(Roles = "Host")]
    [HttpGet("host/{id:guid}")]
    public async Task<IActionResult> GetHostProperty(Guid id, CancellationToken cancellationToken)
    {
        if (CurrentUserId is not { } hostId)
            return Unauthorized(new { Message = "Invalid user token." });

        var property = await dbContext.Properties
            .AsNoTracking()
            .Include(p => p.PropertyImages)
            .Include(p => p.UnavailableDates)
            .FirstOrDefaultAsync(p => p.Id == id && p.HostId == hostId, cancellationToken);

        if (property is null)
            return NotFound(new { Message = "Property not found." });

        var response = new HostPropertyDetailsDto(
            property.Id,
            property.Name.Ar,
            property.Name.En,
            property.Description.Ar,
            property.Description.En,
            property.Location.Country,
            property.Location.City,
            property.Location.Street,
            property.Location.ZipCode,
            property.Location.MapUrl,
            property.PricePerNight.Amount,
            property.PricePerNight.Currency,
            property.MaxGuests,
            property.Status,
            property.RejectionReason,
            property.PropertyImages
                .OrderByDescending(i => i.IsMain)
                .Select(i => new HostPropertyImageDto(i.Id, i.Url, i.IsMain))
                .ToList(),
            property.UnavailableDates
                .OrderBy(u => u.StartDate)
                .Select(u => new HostBlockedDateDto(u.Id, u.StartDate, u.EndDate, u.Reason))
                .ToList());

        return Ok(response);
    }

    [HttpPost]
    [Authorize(Roles = "Host")]
    public async Task<IActionResult> CreateProperty([FromForm] CreatePropertyDto dto, CancellationToken cancellationToken)
    {
        if (CurrentUserId is not { } hostId)
            return Unauthorized(new { Message = "Invalid user token." });

        var host = await userManager.FindByIdAsync(hostId.ToString());
        if (host is null)
            return Unauthorized(new { Message = "Host account not found." });

        if (!EgyptianPhoneNumber.IsValidLocal(host.PhoneNumber))
            return BadRequest(new { Message = "Mobile number is required for payment security. Please update your profile before creating a listing." });

        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        if (dto.Images is null || dto.Images.Count == 0)
            return BadRequest(new { Message = "At least one property image is required." });

        var property = new Property(
            hostId,
            new LocalizedText(dto.NameAr, dto.NameEn),
            new LocalizedText(dto.DescriptionAr, dto.DescriptionEn),
            new Address(dto.Country, dto.City, dto.Street, dto.ZipCode, dto.MapUrl),
            new Money(dto.PricePerNight, "EGP"),
            dto.MaxGuests);

        var uploadedPublicIds = new List<string>();
        IDbContextTransaction? transaction = null;

        try
        {
            if (dto.Images.Count > 0)
            {
                var isFirst = true;
                foreach (var file in dto.Images)
                {
                    if (file.Length == 0)
                        continue;

                    var uploadResult = await cloudStorageService.UploadPropertyImageAsync(hostId, property.Id, file, cancellationToken);

                    property.PropertyImages.Add(new PropertyImage(
                        property.Id,
                        uploadResult.Url,
                        uploadResult.PublicId,
                        isFirst));

                    uploadedPublicIds.Add(uploadResult.PublicId);
                    isFirst = false;
                }
            }

            transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
            await dbContext.Properties.AddAsync(property, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            // Broadcast real-time notification to Admins
            try
            {
                var admins = await userManager.GetUsersInRoleAsync("Admin");
                if (admins.Any())
                {
                    var title = "New Property Awaiting Approval";
                    var message = $"A new property '{property.Name.En}' was added and requires your approval.";

                    await notificationHub.Clients.Users(admins.Select(a => a.Id)).SendAsync("ReceiveNotification", new
                    {
                        title,
                        message,
                        propertyName = property.Name.En,
                        targetLink = "/admin/approvals"
                    }, cancellationToken);
                }
            }
            catch { /* Best effort */ }

            return CreatedAtAction(nameof(GetHostProperty), new { id = property.Id }, new
            {
                property.Id,
                Message = "Property created successfully.",
                ImagesUploaded = property.PropertyImages.Count
            });
        }
        catch (Exception ex)
        {
            if (transaction is not null)
                await transaction.RollbackAsync(cancellationToken);

            foreach (var publicId in uploadedPublicIds)
            {
                try
                {
                    await cloudStorageService.DeleteAsync(publicId, cancellationToken);
                }
                catch
                {
                }
            }

            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                Message = "An error occurred while saving the property. Uploaded images were rolled back.",
                Details = ex.Message
            });
        }
    }

    [Authorize(Roles = "Host")]
    [HttpPut("host/{id:guid}")]
    public async Task<IActionResult> UpdateProperty(Guid id, [FromForm] CreatePropertyDto dto, CancellationToken cancellationToken)
    {
        if (CurrentUserId is not { } hostId)
            return Unauthorized(new { Message = "Invalid user token." });

        var property = await dbContext.Properties
            .Include(p => p.PropertyImages)
            .FirstOrDefaultAsync(p => p.Id == id && p.HostId == hostId, cancellationToken);

        if (property is null)
            return NotFound(new { Message = "Property not found." });

        property.UpdateDetails(
            new LocalizedText(dto.NameAr, dto.NameEn),
            new LocalizedText(dto.DescriptionAr, dto.DescriptionEn),
            new Address(dto.Country, dto.City, dto.Street, dto.ZipCode, dto.MapUrl),
            new Money(dto.PricePerNight, property.PricePerNight.Currency),
            dto.MaxGuests);

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { Message = "Property updated successfully.", PropertyId = property.Id });
    }

    [Authorize(Roles = "Host")]
    [HttpDelete("host/{id:guid}")]
    public async Task<IActionResult> DeleteHostProperty(Guid id, CancellationToken cancellationToken)
    {
        if (CurrentUserId is not { } hostId)
            return Unauthorized(new { Message = "Invalid user token." });

        var property = await dbContext.Properties
            .AsNoTracking()
            .Include(p => p.PropertyImages)
            .FirstOrDefaultAsync(p => p.Id == id && p.HostId == hostId, cancellationToken);

        if (property is null)
            return NotFound(new { Message = "Property not found." });

        var hasBookings = await dbContext.Bookings
            .AsNoTracking()
            .AnyAsync(b => b.PropertyId == id && b.Status != BookingStatus.HostBlocked, cancellationToken);

        if (hasBookings)
            return BadRequest(new { Message = "Properties with booking history cannot be deleted." });

        foreach (var image in property.PropertyImages)
        {
            await cloudStorageService.DeleteAsync(image.PublicId, cancellationToken);
        }

        var affectedRows = await dbContext.Properties
            .Where(p => p.Id == id && p.HostId == hostId)
            .ExecuteUpdateAsync(
                updates => updates
                    .SetProperty(p => p.Status, PropertyStatus.Rejected)
                    .SetProperty(p => p.RejectionReason, "Archived by host"),
                cancellationToken);

        if (affectedRows == 0)
            return NotFound(new { Message = "Property not found." });

        return Ok(new { Message = "Property archived successfully." });
    }

    [Authorize(Roles = "Host")]
    [HttpPatch("host/{id:guid}/status")]
    public async Task<IActionResult> TogglePropertyStatus(Guid id, [FromBody] UpdatePropertyStatusDto dto, CancellationToken cancellationToken)
    {
        if (CurrentUserId is not { } hostId)
            return Unauthorized(new { Message = "Invalid user token." });

        var targetStatus = dto.IsActive ? PropertyStatus.Approved : PropertyStatus.Pending;
        var reason = dto.IsActive ? null : (string.IsNullOrWhiteSpace(dto.Reason) ? "Temporarily hidden by host." : dto.Reason.Trim());

        var affectedRows = await dbContext.Properties
            .Where(p => p.Id == id && p.HostId == hostId)
            .ExecuteUpdateAsync(
                updates => updates
                    .SetProperty(p => p.Status, targetStatus)
                    .SetProperty(p => p.RejectionReason, reason),
                cancellationToken);

        if (affectedRows == 0)
            return NotFound(new { Message = "Property not found." });

        return Ok(new
        {
            Message = dto.IsActive ? "Property is now active." : "Property moved to pending state.",
            Status = dto.IsActive ? "Active" : "Pending"
        });
    }

    [Authorize(Roles = "Host")]
    [HttpGet("host/{id:guid}/calendar")]
    public async Task<IActionResult> GetHostCalendar(Guid id, CancellationToken cancellationToken)
    {
        if (CurrentUserId is not { } hostId)
            return Unauthorized(new { Message = "Invalid user token." });

        var ownsProperty = await dbContext.Properties
            .AsNoTracking()
            .AnyAsync(p => p.Id == id && p.HostId == hostId, cancellationToken);

        if (!ownsProperty)
            return NotFound(new { Message = "Property not found." });

        var blockedDates = await dbContext.UnavailableDates
            .AsNoTracking()
            .Where(u => u.PropertyId == id)
            .OrderBy(u => u.StartDate)
            .Select(u => new HostBlockedDateDto(u.Id, u.StartDate, u.EndDate, u.Reason))
            .ToListAsync(cancellationToken);

        return Ok(blockedDates);
    }

    [Authorize(Roles = "Host")]
    [HttpPost("host/{id:guid}/calendar/block-dates")]
    public async Task<IActionResult> BlockDates(Guid id, [FromBody] RentalsPlatform.Application.DTOs.Calendar.BlockDto dto, CancellationToken cancellationToken)
    {
        if (CurrentUserId is not { } hostId)
            return Unauthorized(new { Message = "Invalid user token." });

        var ownsProperty = await dbContext.Properties
            .AsNoTracking()
            .AnyAsync(p => p.Id == id && p.HostId == hostId, cancellationToken);

        if (!ownsProperty)
            return NotFound(new { Message = "Property not found." });

        var overlap = await dbContext.UnavailableDates
            .AsNoTracking()
            .AnyAsync(u => u.PropertyId == id && u.StartDate < dto.EndDate && u.EndDate > dto.StartDate, cancellationToken);

        if (overlap)
            return BadRequest(new { Message = "The selected period is already blocked." });

        var bookingOverlap = await dbContext.Bookings
            .AsNoTracking()
            .AnyAsync(b => b.PropertyId == id && b.StartDate < dto.EndDate && b.EndDate > dto.StartDate && b.Status != BookingStatus.Cancelled, cancellationToken);

        if (bookingOverlap)
            return BadRequest(new { Message = "The selected period overlaps with an existing reservation." });

        var block = new UnavailableDate(id, dto.StartDate, dto.EndDate, dto.Reason);
        await dbContext.UnavailableDates.AddAsync(block, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new HostBlockedDateDto(block.Id, block.StartDate, block.EndDate, block.Reason));
    }

    [Authorize(Roles = "Host")]
    [HttpDelete("host/{id:guid}/calendar/block-dates/{blockId:guid}")]
    public async Task<IActionResult> UnblockDates(Guid id, Guid blockId, CancellationToken cancellationToken)
    {
        if (CurrentUserId is not { } hostId)
            return Unauthorized(new { Message = "Invalid user token." });

        var deletedCount = await dbContext.UnavailableDates
            .Where(u => u.Id == blockId && u.PropertyId == id && dbContext.Properties.Any(p => p.Id == id && p.HostId == hostId))
            .ExecuteDeleteAsync(cancellationToken);

        if (deletedCount == 0)
            return NotFound(new { Message = "Blocked date range not found." });

        return Ok(new { Message = "Blocked date removed successfully." });
    }

    [Authorize(Roles = "Host")]
    [HttpPost("{id:guid}/price-rules")]
    public async Task<IActionResult> CreatePriceRule(Guid id, [FromBody] CreatePropertyPriceRuleDto dto, CancellationToken cancellationToken)
    {
        if (dto.StartDate > dto.EndDate)
            return BadRequest(new { Message = "StartDate must be before or equal to EndDate." });

        if (dto.CustomPricePerNight <= 0)
            return BadRequest(new { Message = "CustomPricePerNight must be greater than zero." });

        if (CurrentUserId is not { } hostId)
            return Unauthorized();

        var property = await dbContext.Properties
            .FirstOrDefaultAsync(p => p.Id == id && p.HostId == hostId, cancellationToken);

        if (property is null)
            return NotFound(new { Message = "Property not found or not owned by host." });

        var hasOverlap = await dbContext.PropertyPriceRules
            .AsNoTracking()
            .AnyAsync(r =>
                r.PropertyId == id &&
                r.StartDate <= dto.EndDate &&
                r.EndDate >= dto.StartDate,
                cancellationToken);

        if (hasOverlap)
            return BadRequest(new { Message = "Overlapping price rules are not allowed for the same property." });

        var rule = new Domain.Entities.PropertyPriceRule(id, dto.StartDate, dto.EndDate, dto.CustomPricePerNight);

        await dbContext.PropertyPriceRules.AddAsync(rule, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new PropertyPriceRuleDto
        {
            Id = rule.Id,
            StartDate = rule.StartDate,
            EndDate = rule.EndDate,
            CustomPricePerNight = rule.CustomPricePerNight
        });
    }

    [Authorize(Roles = "Host")]
    [HttpGet("{id:guid}/price-rules")]
    public async Task<IActionResult> GetPriceRules(Guid id, CancellationToken cancellationToken)
    {
        if (CurrentUserId is not { } hostId)
            return Unauthorized();

        var isOwner = await dbContext.Properties
            .AsNoTracking()
            .AnyAsync(p => p.Id == id && p.HostId == hostId, cancellationToken);

        if (!isOwner)
            return NotFound(new { Message = "Property not found or not owned by host." });

        var rules = await dbContext.PropertyPriceRules
            .AsNoTracking()
            .Where(r => r.PropertyId == id)
            .OrderBy(r => r.StartDate)
            .Select(r => new PropertyPriceRuleDto
            {
                Id = r.Id,
                StartDate = r.StartDate,
                EndDate = r.EndDate,
                CustomPricePerNight = r.CustomPricePerNight
            })
            .ToListAsync(cancellationToken);

        return Ok(rules);
    }

    [Authorize(Roles = "Host")]
    [HttpDelete("{id:guid}/price-rules/{ruleId:guid}")]
    public async Task<IActionResult> DeletePriceRule(Guid id, Guid ruleId, CancellationToken cancellationToken)
    {
        if (CurrentUserId is not { } hostId)
            return Unauthorized();

        var isOwner = await dbContext.Properties
            .AsNoTracking()
            .AnyAsync(p => p.Id == id && p.HostId == hostId, cancellationToken);

        if (!isOwner)
            return NotFound(new { Message = "Property not found or not owned by host." });

        var rule = await dbContext.PropertyPriceRules
            .FirstOrDefaultAsync(r => r.Id == ruleId && r.PropertyId == id, cancellationToken);

        if (rule is null)
            return NotFound(new { Message = "Price rule not found." });

        dbContext.PropertyPriceRules.Remove(rule);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Price rule deleted successfully." });
    }

    [Authorize(Roles = "Host")]
    [HttpPost("{id:guid}/images")]
    public async Task<IActionResult> UploadPropertyImages(Guid id, [FromForm] List<IFormFile> files, CancellationToken cancellationToken)
    {
        if (files is null || files.Count == 0)
            return BadRequest(new { Message = "At least one image is required." });

        if (CurrentUserId is not { } hostId)
            return Unauthorized();

        var property = await dbContext.Properties
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id && p.HostId == hostId, cancellationToken);

        if (property is null)
            return NotFound(new { Message = "Property not found or not owned by host." });

        var hasMainImage = await dbContext.PropertyImages
            .AsNoTracking()
            .AnyAsync(i => i.PropertyId == id && i.IsMain, cancellationToken);

        var uploadedUrls = new List<string>();
        var entities = new List<PropertyImage>();

        try
        {
            foreach (var file in files)
            {
                var uploadResult = await cloudStorageService.UploadPropertyImageAsync(hostId, id, file, cancellationToken);

                var isMain = !hasMainImage && entities.Count == 0;
                var propertyImage = new PropertyImage(id, uploadResult.Url, uploadResult.PublicId, isMain);

                entities.Add(propertyImage);
                uploadedUrls.Add(uploadResult.Url);
            }

            if (entities.Count == 0)
                return BadRequest(new { Message = "No valid images were uploaded." });

            await dbContext.PropertyImages.AddRangeAsync(entities, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Ok(uploadedUrls);
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { Message = ex.Message });
        }
    }

    [Authorize(Roles = "Host")]
    [HttpPatch("{id:guid}/images/{imageId:guid}/main")]
    public async Task<IActionResult> SetMainImage(Guid id, Guid imageId, CancellationToken cancellationToken)
    {
        if (CurrentUserId is not { } hostId)
            return Unauthorized();

        var isOwner = await dbContext.Properties
            .AsNoTracking()
            .AnyAsync(p => p.Id == id && p.HostId == hostId, cancellationToken);

        if (!isOwner)
            return NotFound(new { Message = "Property not found or not owned by host." });

        var imageExists = await dbContext.PropertyImages
            .AsNoTracking()
            .AnyAsync(i => i.Id == imageId && i.PropertyId == id, cancellationToken);

        if (!imageExists)
            return NotFound(new { Message = "Image not found." });

        await dbContext.PropertyImages
            .Where(i => i.PropertyId == id)
            .ExecuteUpdateAsync(setters => setters.SetProperty(i => i.IsMain, false), cancellationToken);

        await dbContext.PropertyImages
            .Where(i => i.Id == imageId && i.PropertyId == id)
            .ExecuteUpdateAsync(setters => setters.SetProperty(i => i.IsMain, true), cancellationToken);

        return Ok(new { Message = "Main image updated successfully." });
    }

    [Authorize(Roles = "Host")]
    [HttpDelete("{id:guid}/images/{imageId:guid}")]
    public async Task<IActionResult> DeletePropertyImage(Guid id, Guid imageId, CancellationToken cancellationToken)
    {
        if (CurrentUserId is not { } hostId)
            return Unauthorized();

        var isOwner = await dbContext.Properties
            .AsNoTracking()
            .AnyAsync(p => p.Id == id && p.HostId == hostId, cancellationToken);

        if (!isOwner)
            return NotFound(new { Message = "Property not found or not owned by host." });

        var image = await dbContext.PropertyImages
            .FirstOrDefaultAsync(i => i.Id == imageId && i.PropertyId == id, cancellationToken);

        if (image is null)
            return NotFound(new { Message = "Image not found." });

        var deletedFromCloud = await cloudStorageService.DeleteAsync(image.PublicId, cancellationToken);

        if (!deletedFromCloud)
            return BadRequest(new { Message = "Failed to delete image from cloud storage." });

        dbContext.PropertyImages.Remove(image);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Image deleted successfully." });
    }
}