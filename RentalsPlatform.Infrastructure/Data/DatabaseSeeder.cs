using Microsoft.AspNetCore.Identity;

namespace RentalsPlatform.Infrastructure.Data;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(RoleManager<IdentityRole> roleManager, UserManager<IdentityUser> userManager)
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
            var hostUser = new IdentityUser
            {
                UserName = "host@local.com",
                Email = "host@local.com",
                EmailConfirmed = true
            };
            var result = await userManager.CreateAsync(hostUser, "Password123!");
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(hostUser, "Host");
            }
        }

        // 3. إنشاء حساب ضيف (Guest) جاهز للتجربة
        if (await userManager.FindByEmailAsync("guest@local.com") == null)
        {
            var guestUser = new IdentityUser
            {
                UserName = "guest@local.com",
                Email = "guest@local.com",
                EmailConfirmed = true
            };
            var result = await userManager.CreateAsync(guestUser, "Password123!");
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(guestUser, "Guest");
            }
        }
    }
}