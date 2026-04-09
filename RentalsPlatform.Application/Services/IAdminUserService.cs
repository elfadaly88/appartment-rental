using RentalsPlatform.Application.Common;
using RentalsPlatform.Application.DTOs.Admin;

namespace RentalsPlatform.Application.Services;

public interface IAdminUserService
{
    Task<IEnumerable<AdminUserDto>> GetUsersAsync(string? roleFilter = null);
    Task<Result> BanUserAsync(string userId, string reason);
    Task<Result> UnbanUserAsync(string userId);
}
