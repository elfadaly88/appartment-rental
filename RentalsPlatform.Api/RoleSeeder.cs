using Microsoft.AspNetCore.Identity;

namespace RentalsPlatform.Api;

public static class RoleSeeder
{
    private static readonly string[] Roles = ["Admin", "Host", "Guest"];

    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();

        foreach (var role in Roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }
    }
}
