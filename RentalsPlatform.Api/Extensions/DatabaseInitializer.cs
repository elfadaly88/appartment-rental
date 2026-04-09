using System.Net.Sockets;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using RentalsPlatform.Infrastructure.Data;

namespace RentalsPlatform.Api.Extensions;

public static class DatabaseInitializer
{
    public static async Task InitializeDatabaseAsync(this WebApplication app)
    {
        const int maxRetries = 10;
        var attempt = 0;

        while (attempt < maxRetries)
        {
            try
            {
                using var scope = app.Services.CreateScope();
                var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>()
                    .CreateLogger("DatabaseInitializer");
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();

                logger.LogInformation("Attempting database migration (attempt {Attempt}/{MaxRetries}).", attempt + 1, maxRetries);

                await context.Database.MigrateAsync();
                await SeedDefaultRolesAsync(roleManager, logger);

                logger.LogInformation("Database migration completed successfully.");
                return;
            }
            catch (Exception ex) when (ex is NpgsqlException || ex is SocketException || ex.InnerException is SocketException)
            {
                attempt++;

                using var scope = app.Services.CreateScope();
                var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>()
                    .CreateLogger("DatabaseInitializer");

                logger.LogWarning(ex,
                    "Database is not ready yet. Retrying in 2 seconds... ({Attempt}/{MaxRetries})",
                    attempt,
                    maxRetries);

                if (attempt >= maxRetries)
                {
                    logger.LogCritical(ex, "Database initialization failed after {MaxRetries} attempts.", maxRetries);
                    throw;
                }

                await Task.Delay(TimeSpan.FromSeconds(2));
            }
        }
    }

    private static async Task SeedDefaultRolesAsync(RoleManager<IdentityRole> roleManager, ILogger logger)
    {
        string[] roles = ["Admin", "Host", "Guest"];

        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                var result = await roleManager.CreateAsync(new IdentityRole(role));
                if (!result.Succeeded)
                {
                    logger.LogError("Failed to create role {Role}: {Errors}", role, string.Join("; ", result.Errors.Select(e => e.Description)));
                }
            }
        }
    }
}
