using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RentalsPlatform.Application.Services;
using RentalsPlatform.Infrastructure.Services;
using SendGrid;

namespace RentalsPlatform.Infrastructure.Extensions;

public static class BackgroundJobsAndEmailsServiceCollectionExtensions
{
    public static IServiceCollection AddBackgroundJobsAndEmails(this IServiceCollection services, IConfiguration config)
    {
        services.AddHangfire(options => options
            .UsePostgreSqlStorage(storageOptions =>
                storageOptions.UseNpgsqlConnection(config.GetConnectionString("DefaultConnection"))));

        services.AddHangfireServer();

        services.AddScoped<IEmailService, SendGridEmailService>();

        services.AddSingleton<ISendGridClient>(_ =>
        {
            var apiKey = config["SendGrid:ApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
                throw new InvalidOperationException("SendGrid API key is missing in configuration (SendGrid:ApiKey).");

            return new SendGridClient(new SendGridClientOptions
            {
                ApiKey = apiKey
            });
        });

        return services;
    }
}
