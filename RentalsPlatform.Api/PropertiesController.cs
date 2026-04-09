using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Application.DTOs.Properties;
using RentalsPlatform.Application.Interfaces;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Domain.ValueObjects;
using RentalsPlatform.Infrastructure.Data;
using RentalsPlatform.Infrastructure.Services;
using System.Security.Claims;

namespace RentalsPlatform.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PropertiesController : ControllerBase
{
    private readonly IImageService _imageService;
    private readonly IPropertyRepository _propertyRepository;
    private readonly ApplicationDbContext _dbContext;

    public PropertiesController(
        IImageService imageService,
        IPropertyRepository propertyRepository,
        ApplicationDbContext dbContext)
    {
        _imageService = imageService;
        _propertyRepository = propertyRepository;
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetProperties(CancellationToken cancellationToken)
    {
        var properties = await _propertyRepository.GetAllAsync(cancellationToken);

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

    [HttpPost]
    [Authorize(Roles = "Host")]
    public async Task<IActionResult> CreateProperty([FromForm] CreatePropertyDto dto, CancellationToken cancellationToken)
    {
        var hostIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(hostIdValue, out var hostId))
            return Unauthorized(new { Message = "Invalid user token." });

        var property = new Property(
            hostId,
            new LocalizedText(dto.NameAr, dto.NameEn),
            new LocalizedText(dto.DescriptionAr, dto.DescriptionEn),
            new Address(string.Empty, string.Empty, string.Empty, string.Empty, string.Empty),
            new Money(dto.PricePerNight, "EGP"),
            dto.MaxGuests);

        var uploadedPublicIds = new List<string>();

        try
        {
            if (dto.Images is not null && dto.Images.Count > 0)
            {
                var isFirst = true;
                foreach (var file in dto.Images)
                {
                    if (file.Length == 0)
                        continue;

                    var uploadResult = await _imageService.UploadImageAsync(file);

                    property.PropertyImages.Add(new PropertyImage(
                        property.Id,
                        uploadResult.Url,
                        uploadResult.PublicId,
                        isFirst));

                    uploadedPublicIds.Add(uploadResult.PublicId);
                    isFirst = false;
                }
            }

            await _dbContext.Properties.AddAsync(property, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);

            return CreatedAtAction(nameof(GetProperties), new { id = property.Id }, new
            {
                property.Id,
                Message = "Property created successfully.",
                ImagesUploaded = property.PropertyImages.Count
            });
        }
        catch (Exception ex)
        {
            foreach (var publicId in uploadedPublicIds)
            {
                try
                {
                    await _imageService.DeleteImageAsync(publicId);
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
    [HttpPost("{id:guid}/price-rules")]
    public async Task<IActionResult> CreatePriceRule(Guid id, [FromBody] CreatePropertyPriceRuleDto dto, CancellationToken cancellationToken)
    {
        if (dto.StartDate > dto.EndDate)
            return BadRequest(new { Message = "StartDate must be before or equal to EndDate." });

        if (dto.CustomPricePerNight <= 0)
            return BadRequest(new { Message = "CustomPricePerNight must be greater than zero." });

        var hostIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(hostIdValue, out var hostId))
            return Unauthorized();

        var property = await _dbContext.Properties
            .FirstOrDefaultAsync(p => p.Id == id && p.HostId == hostId, cancellationToken);

        if (property is null)
            return NotFound(new { Message = "Property not found or not owned by host." });

        var hasOverlap = await _dbContext.PropertyPriceRules
            .AsNoTracking()
            .AnyAsync(r =>
                r.PropertyId == id &&
                r.StartDate <= dto.EndDate &&
                r.EndDate >= dto.StartDate,
                cancellationToken);

        if (hasOverlap)
            return BadRequest(new { Message = "Overlapping price rules are not allowed for the same property." });

        var rule = new Domain.Entities.PropertyPriceRule(id, dto.StartDate, dto.EndDate, dto.CustomPricePerNight);

        await _dbContext.PropertyPriceRules.AddAsync(rule, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

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
        var hostIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(hostIdValue, out var hostId))
            return Unauthorized();

        var isOwner = await _dbContext.Properties
            .AsNoTracking()
            .AnyAsync(p => p.Id == id && p.HostId == hostId, cancellationToken);

        if (!isOwner)
            return NotFound(new { Message = "Property not found or not owned by host." });

        var rules = await _dbContext.PropertyPriceRules
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
        var hostIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(hostIdValue, out var hostId))
            return Unauthorized();

        var isOwner = await _dbContext.Properties
            .AsNoTracking()
            .AnyAsync(p => p.Id == id && p.HostId == hostId, cancellationToken);

        if (!isOwner)
            return NotFound(new { Message = "Property not found or not owned by host." });

        var rule = await _dbContext.PropertyPriceRules
            .FirstOrDefaultAsync(r => r.Id == ruleId && r.PropertyId == id, cancellationToken);

        if (rule is null)
            return NotFound(new { Message = "Price rule not found." });

        _dbContext.PropertyPriceRules.Remove(rule);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Price rule deleted successfully." });
    }

    [Authorize(Roles = "Host")]
    [HttpGet("host-dummy")]
    public IActionResult HostOnlyDummyEndpoint()
    {
        return Ok(new { Message = "Host authorized endpoint." });
    }

    [Authorize(Roles = "Host")]
    [HttpPost("{id:guid}/images")]
    public async Task<IActionResult> UploadPropertyImages(Guid id, [FromForm] List<IFormFile> files, CancellationToken cancellationToken)
    {
        if (files is null || files.Count == 0)
            return BadRequest(new { Message = "At least one image is required." });

        var hostIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(hostIdValue, out var hostId))
            return Unauthorized();

        var property = await _dbContext.Properties
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id && p.HostId == hostId, cancellationToken);

        if (property is null)
            return NotFound(new { Message = "Property not found or not owned by host." });

        var hasMainImage = await _dbContext.PropertyImages
            .AsNoTracking()
            .AnyAsync(i => i.PropertyId == id && i.IsMain, cancellationToken);

        var uploadedUrls = new List<string>();
        var entities = new List<PropertyImage>();

        try
        {
            foreach (var file in files)
            {
                var uploadResult = await _imageService.UploadImageAsync(file);

                var isMain = !hasMainImage && entities.Count == 0;
                var propertyImage = new PropertyImage(id, uploadResult.Url, uploadResult.PublicId, isMain);

                entities.Add(propertyImage);
                uploadedUrls.Add(uploadResult.Url);
            }

            if (entities.Count == 0)
                return BadRequest(new { Message = "No valid images were uploaded." });

            await _dbContext.PropertyImages.AddRangeAsync(entities, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);

            return Ok(uploadedUrls);
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { Message = ex.Message });
        }
    }
    [Authorize(Roles = "Host")]
    [HttpDelete("{id:guid}/images/{imageId:guid}")]
    public async Task<IActionResult> DeletePropertyImage(Guid id, Guid imageId, CancellationToken cancellationToken)
    {
        var hostIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(hostIdValue, out var hostId))
            return Unauthorized();

        // التأكد من ملكية العقار
        var isOwner = await _dbContext.Properties
            .AsNoTracking()
            .AnyAsync(p => p.Id == id && p.HostId == hostId, cancellationToken);

        if (!isOwner)
            return NotFound(new { Message = "Property not found or not owned by host." });

        // إيجاد الصورة
        var image = await _dbContext.PropertyImages
            .FirstOrDefaultAsync(i => i.Id == imageId && i.PropertyId == id, cancellationToken);

        if (image is null)
            return NotFound(new { Message = "Image not found." });

        // 1. مسح الصورة من سيرفرات Cloudinary
        var deletedFromCloud = await _imageService.DeleteImageAsync(image.PublicId);

        if (!deletedFromCloud)
            return BadRequest(new { Message = "Failed to delete image from cloud storage." });

        // 2. مسح الصورة من قاعدة البيانات
        _dbContext.PropertyImages.Remove(image);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Image deleted successfully." });
    }
}