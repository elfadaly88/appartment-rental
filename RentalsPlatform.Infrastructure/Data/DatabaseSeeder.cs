using Microsoft.AspNetCore.Identity;
using RentalsPlatform.Domain.Entities;

namespace RentalsPlatform.Infrastructure.Data;

public static class DatabaseSeeder
{
    private static void EnsureIdentityResult(IdentityResult result, string userEmail)
    {
        if (result.Succeeded)
            return;

        var errors = string.Join("; ", result.Errors.Select(e => $"{e.Code}: {e.Description}"));
        throw new InvalidOperationException($"Failed to seed user '{userEmail}'. Errors: {errors}");
    }

    public static async Task SeedAsync(RoleManager<IdentityRole> roleManager, UserManager<ApplicationUser> userManager)
    {
        // 1. إنشاء الصلاحيات الأساسية
        var roles = new[] { "Admin", "Host", "Guest" };
        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }

        // 2. إنشاء حساب مالك (Host) جاهز للتجربة
        if (await userManager.FindByEmailAsync("host@local.com") == null)
        {
            var hostUser = new ApplicationUser
            {
                UserName = "host@local.com",
                Email = "host@local.com",
                EmailConfirmed = true
            };
            var result = await userManager.CreateAsync(hostUser, "Password123!");
            EnsureIdentityResult(result, hostUser.Email!);
            await userManager.AddToRoleAsync(hostUser, "Host");
        }

        // 3. إنشاء حساب ضيف (Guest) جاهز للتجربة
        if (await userManager.FindByEmailAsync("guest@local.com") == null)
        {
            var guestUser = new ApplicationUser
            {
                UserName = "guest@local.com",
                Email = "guest@local.com",
                EmailConfirmed = true
            };
            var result = await userManager.CreateAsync(guestUser, "Password123!");
            EnsureIdentityResult(result, guestUser.Email!);
            await userManager.AddToRoleAsync(guestUser, "Guest");
        }

        // 4. إنشاء حساب مدير (Admin) جاهز للتجربة
        if (await userManager.FindByEmailAsync("admin@admin.com") == null)
        {
            var adminUser = new ApplicationUser
            {
                UserName = "admin@admin.com",
                Email = "admin@admin.com",
                EmailConfirmed = true
            };
            var result = await userManager.CreateAsync(adminUser, "Admin@123");
            EnsureIdentityResult(result, adminUser.Email!);
            await userManager.AddToRoleAsync(adminUser, "Admin");
        }
    }
}