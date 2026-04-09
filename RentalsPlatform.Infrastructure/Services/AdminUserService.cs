using Hangfire;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Application.Common;
using RentalsPlatform.Application.DTOs.Admin;
using RentalsPlatform.Application.Services;
using RentalsPlatform.Domain.Entities;

namespace RentalsPlatform.Infrastructure.Services;

public class AdminUserService : IAdminUserService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IBackgroundJobClient _backgroundJobClient;

    public AdminUserService(UserManager<ApplicationUser> userManager, IBackgroundJobClient backgroundJobClient)
    {
        _userManager = userManager;
        _backgroundJobClient = backgroundJobClient;
    }

    public async Task<IEnumerable<AdminUserDto>> GetUsersAsync(string? roleFilter = null)
    {
        var users = string.IsNullOrWhiteSpace(roleFilter)
            ? await _userManager.Users.AsNoTracking().ToListAsync()
            : await _userManager.GetUsersInRoleAsync(roleFilter);

        var result = new List<AdminUserDto>(users.Count);

        foreach (var user in users)
        {
            var roles = await _userManager.GetRolesAsync(user);
            var primaryRole = roles.FirstOrDefault() ?? "NoRole";

            result.Add(new AdminUserDto
            {
                Id = user.Id,
                FullName = string.Join(" ", new[] { user.FirstName, user.LastName }.Where(x => !string.IsNullOrWhiteSpace(x))).Trim(),
                Email = user.Email ?? string.Empty,
                Role = primaryRole,
                IsBanned = user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTimeOffset.UtcNow,
                BanReason = user.BanReason,
                CreatedAt = user.CreatedAt
            });
        }

        return result;
    }

    public async Task<Result> BanUserAsync(string userId, string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            return Result.Failure("Ban reason is required.");

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return Result.Failure("User not found.");

        user.LockoutEnabled = true;
        user.LockoutEnd = DateTimeOffset.MaxValue;
        user.BanReason = reason.Trim();

        var updateResult = await _userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
            return Result.Failure(string.Join("; ", updateResult.Errors.Select(e => e.Description)));

        if (!string.IsNullOrWhiteSpace(user.Email))
        {
            var fullName = string.Join(" ", new[] { user.FirstName, user.LastName }
                .Where(x => !string.IsNullOrWhiteSpace(x))).Trim();

            var templateData = new Dictionary<string, string>
            {
                ["reason"] = reason.Trim(),
                ["name"] = string.IsNullOrWhiteSpace(fullName) ? "User" : fullName
            };

            _backgroundJobClient.Enqueue<IEmailService>(x =>
                x.SendEmailAsync(
                    user.Email,
                    string.IsNullOrWhiteSpace(fullName) ? "User" : fullName,
                    "d-xxx-ban-template",
                    templateData));
        }

        return Result.Success("User banned successfully.");
    }

    public async Task<Result> UnbanUserAsync(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return Result.Failure("User not found.");

        user.LockoutEnd = null;
        user.BanReason = null;

        var updateResult = await _userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
            return Result.Failure(string.Join("; ", updateResult.Errors.Select(e => e.Description)));

        return Result.Success("User unbanned successfully.");
    }
}
