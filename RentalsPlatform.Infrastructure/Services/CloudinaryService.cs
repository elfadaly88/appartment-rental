using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RentalsPlatform.Application.DTOs.Properties;

namespace RentalsPlatform.Infrastructure.Services;

public class CloudinaryImageService : IImageService
{
    private readonly Cloudinary _cloudinary;

    public CloudinaryImageService(IOptions<CloudinarySettings> options)
    {
        var settings = options.Value;

        if (string.IsNullOrWhiteSpace(settings.CloudName) ||
            string.IsNullOrWhiteSpace(settings.ApiKey) ||
            string.IsNullOrWhiteSpace(settings.ApiSecret))
        {
            throw new InvalidOperationException("Cloudinary settings are not configured correctly.");
        }

        var account = new Account(settings.CloudName, settings.ApiKey, settings.ApiSecret);
        _cloudinary = new Cloudinary(account)
        {
            Api = { Secure = true }
        };
    }

    public async Task<ImageUploadResultDto> UploadImageAsync(IFormFile file)
    {
        if (file is null || file.Length <= 0)
            throw new InvalidOperationException("Image file is empty.");

        if (string.IsNullOrWhiteSpace(file.ContentType) || !file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Only image files are allowed.");

        try
        {
            await using var stream = file.OpenReadStream();
            var uploadParams = new ImageUploadParams
            {
                File = new FileDescription(file.FileName, stream),
                Folder = "luxury-properties",
                Transformation = new Transformation()
                    .Quality("auto")
                    .FetchFormat("auto")
            };

            var uploadResult = await _cloudinary.UploadAsync(uploadParams);

            if (uploadResult.Error is not null)
                throw new InvalidOperationException(uploadResult.Error.Message);

            var imageUrl = uploadResult.SecureUrl?.ToString();
            var publicId = uploadResult.PublicId;

            if (string.IsNullOrWhiteSpace(imageUrl) || string.IsNullOrWhiteSpace(publicId))
                throw new InvalidOperationException("Cloudinary upload succeeded but did not return valid image metadata.");

            return new ImageUploadResultDto(imageUrl, publicId);
        }
        catch (TaskCanceledException ex)
        {
            throw new InvalidOperationException("Image service is currently unreachable. Please try again later.", ex);
        }
        catch (HttpRequestException ex)
        {
            throw new InvalidOperationException("Image service is currently unreachable. Please try again later.", ex);
        }
    }

    public async Task<bool> DeleteImageAsync(string publicId)
    {
        if (string.IsNullOrWhiteSpace(publicId))
            return false;

        try
        {
            var deleteResult = await _cloudinary.DestroyAsync(new DeletionParams(publicId));
            return deleteResult.Result is "ok" or "not found";
        }
        catch (TaskCanceledException ex)
        {
            throw new InvalidOperationException("Image service is currently unreachable. Please try again later.", ex);
        }
        catch (HttpRequestException ex)
        {
            throw new InvalidOperationException("Image service is currently unreachable. Please try again later.", ex);
        }
    }
}
