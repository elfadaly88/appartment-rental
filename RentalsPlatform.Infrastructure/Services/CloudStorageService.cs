using System.Text.RegularExpressions;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RentalsPlatform.Application.DTOs.Properties;

namespace RentalsPlatform.Infrastructure.Services;

public sealed class CloudStorageService(IOptions<CloudinarySettings> options) : ICloudStorageService
{
    private const long MaxImageBytes = 10 * 1024 * 1024;
    private static readonly HashSet<string> AllowedContentTypes =
    [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
    ];

    private static readonly HashSet<string> AllowedExtensions =
    [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".gif"
    ];

    private readonly Cloudinary _cloudinary = CreateCloudinary(options.Value);

    public async Task<ImageUploadResultDto> UploadPropertyImageAsync(Guid hostId, Guid propertyId, IFormFile file, CancellationToken cancellationToken = default)
    {
        if (file is null || file.Length <= 0)
            throw new InvalidOperationException("Image file is empty.");

        if (file.Length > MaxImageBytes)
            throw new InvalidOperationException($"Image size exceeds limit of {MaxImageBytes / (1024 * 1024)}MB.");

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var contentType = file.ContentType?.Trim().ToLowerInvariant() ?? string.Empty;

        if (!AllowedExtensions.Contains(extension) || !AllowedContentTypes.Contains(contentType))
            throw new InvalidOperationException("Unsupported image type. Allowed types: jpg, jpeg, png, webp, gif.");

        await using var stream = file.OpenReadStream();
        var publicId = $"hosts/{hostId}/properties/{propertyId}/{BuildSafeFileName(file.FileName)}";
        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(file.FileName, stream),
            PublicId = publicId,
            Overwrite = false,
            UseFilename = false,
            UniqueFilename = true,
            Transformation = new Transformation()
                .Quality("auto")
                .FetchFormat("auto")
        };

        var uploadResult = await _cloudinary.UploadAsync(uploadParams, cancellationToken);

        if (uploadResult.Error is not null)
            throw new InvalidOperationException(uploadResult.Error.Message);

        if (string.IsNullOrWhiteSpace(uploadResult.PublicId) || uploadResult.SecureUrl is null)
            throw new InvalidOperationException("Cloud storage did not return a valid public id or URL.");

        return new ImageUploadResultDto(uploadResult.SecureUrl.ToString(), uploadResult.PublicId);
    }

    public async Task<bool> DeleteAsync(string publicId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(publicId))
            return false;

        var result = await _cloudinary.DestroyAsync(new DeletionParams(publicId));
        return result.Result is "ok" or "not found";
    }

    private static Cloudinary CreateCloudinary(CloudinarySettings settings)
    {
        if (string.IsNullOrWhiteSpace(settings.CloudName) ||
            string.IsNullOrWhiteSpace(settings.ApiKey) ||
            string.IsNullOrWhiteSpace(settings.ApiSecret))
        {
            throw new InvalidOperationException("Cloudinary settings are not configured correctly.");
        }

        return new Cloudinary(new Account(settings.CloudName, settings.ApiKey, settings.ApiSecret))
        {
            Api = { Secure = true }
        };
    }

    private static string BuildSafeFileName(string fileName)
    {
        var baseName = Path.GetFileNameWithoutExtension(fileName);
        var extension = Path.GetExtension(fileName);
        var normalizedBaseName = Regex.Replace(baseName.ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');
        return string.IsNullOrWhiteSpace(normalizedBaseName) ? $"image{extension}" : $"{normalizedBaseName}{extension}";
    }
}