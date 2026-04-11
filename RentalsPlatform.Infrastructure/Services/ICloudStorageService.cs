using Microsoft.AspNetCore.Http;
using RentalsPlatform.Application.DTOs.Properties;

namespace RentalsPlatform.Infrastructure.Services;

public interface ICloudStorageService
{
    Task<ImageUploadResultDto> UploadPropertyImageAsync(Guid hostId, Guid propertyId, IFormFile file, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(string publicId, CancellationToken cancellationToken = default);
}