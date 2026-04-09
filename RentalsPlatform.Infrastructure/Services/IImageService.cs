using Microsoft.AspNetCore.Http;
using RentalsPlatform.Application.DTOs.Properties;

namespace RentalsPlatform.Infrastructure.Services;

public interface IImageService
{
    Task<ImageUploadResultDto> UploadImageAsync(IFormFile file);
    Task<bool> DeleteImageAsync(string publicId);
}
