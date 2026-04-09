using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Caching.Memory;
using RentalsPlatform.Domain.Entities;

namespace RentalsPlatform.Api.Middleware;

public class EnforceBanMiddleware
{
    private readonly RequestDelegate _next;
    private static string CacheKey(string userId) => $"ban-status:{userId}";

    public EnforceBanMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, UserManager<ApplicationUser> userManager, IMemoryCache cache)
    {
        if (context.User.Identity?.IsAuthenticated is true)
        {
            var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!string.IsNullOrWhiteSpace(userId))
            {
                var isBanned = await cache.GetOrCreateAsync(CacheKey(userId), async entry =>
                {
                    entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30);

                    var user = await userManager.FindByIdAsync(userId);
                    return user is not null && user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTimeOffset.UtcNow;
                });

                if (isBanned)
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsJsonAsync(new { Message = "Your account is banned. Please contact support." });
                    return;
                }
            }
        }

        await _next(context);
    }
}
