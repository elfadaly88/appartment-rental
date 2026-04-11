using System.Reflection;
using System.Text;
using FluentValidation;
using FluentValidation.AspNetCore;
using Hangfire;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using RentalsPlatform.Api;
using RentalsPlatform.Api.Extensions;
using RentalsPlatform.Api.Middleware;
using RentalsPlatform.Application.Interfaces;
using RentalsPlatform.Application.Services;
using RentalsPlatform.Application.Validators;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Infrastructure.Data;
using RentalsPlatform.Infrastructure.Extensions;
using RentalsPlatform.Infrastructure.Hubs;
using RentalsPlatform.Infrastructure.Repositories;
using RentalsPlatform.Infrastructure.Services;
using WebPush;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("JwtSettings"));
builder.Services.Configure<VapidDetailsSettings>(builder.Configuration.GetSection("VapidDetails"));
builder.Services.Configure<PaymobSettings>(builder.Configuration.GetSection("Paymob"));
var jwtSettings = builder.Configuration.GetSection("JwtSettings").Get<JwtSettings>() ?? new JwtSettings();
var secretKey = Encoding.UTF8.GetBytes(jwtSettings.Key);

builder.Services
    .AddIdentityCore<ApplicationUser>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequireDigit = true;
        options.Password.RequiredLength = 8;
        options.Password.RequireNonAlphanumeric = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireLowercase = true;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddSignInManager()
    .AddDefaultTokenProviders();

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings.Issuer,
        ValidAudience = jwtSettings.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(secretKey),
        ClockSkew = TimeSpan.FromMinutes(1)
    };

    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;

            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/notifications"))
            {
                context.Token = accessToken;
            }

            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
    options.AddPolicy("HostOnly", policy => policy.RequireRole("Host"));
    options.AddPolicy("GuestOnly", policy => policy.RequireRole("Guest"));
});

builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(IPropertyRepository).Assembly));
builder.Services.AddScoped<IPropertyRepository, PropertyRepository>();
builder.Services.AddScoped<IBookingRepository, BookingRepository>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IWebPushService, WebPushService>();
builder.Services.AddSingleton<WebPushClient>();
builder.Services.AddTransient<IPayoutService, PayoutService>();
builder.Services.Configure<CloudinarySettings>(builder.Configuration.GetSection("CloudinarySettings"));
builder.Services.AddScoped<IImageService, CloudinaryImageService>();
builder.Services.AddScoped<ICloudStorageService, CloudStorageService>();
builder.Services.AddMemoryCache();
builder.Services.AddScoped<ILookupService, LookupService>();
builder.Services.AddScoped<IBookingService, BookingService>();
builder.Services.AddScoped<IAvailabilityService, AvailabilityService>();
builder.Services.AddScoped<IHostCalendarService, HostCalendarService>();
builder.Services.AddScoped<IAnalyticsService, AnalyticsService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<IReviewService, ReviewService>();
builder.Services.AddScoped<IAdminService, AdminService>();
builder.Services.AddScoped<IAdminUserService, AdminUserService>();
builder.Services.AddScoped<IAdminAnalyticsService, AdminAnalyticsService>();
builder.Services.AddScoped<IPricingService, PricingService>();

var paymentProvider = builder.Configuration["Payment:Provider"] ?? "Paymob";

if (string.Equals(paymentProvider, "Mock", StringComparison.OrdinalIgnoreCase))
{
    if (!builder.Environment.IsDevelopment())
        throw new InvalidOperationException("Mock payment provider is only allowed in Development environment.");

    builder.Services.AddScoped<IPaymobService, MockPaymobService>();
}
else
{
    builder.Services.AddHttpClient<PaymobService>((sp, client) =>
    {
        var settings = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<PaymobSettings>>().Value;
        client.BaseAddress = new Uri(settings.BaseUrl.EndsWith('/') ? settings.BaseUrl : $"{settings.BaseUrl}/");
    });
    builder.Services.AddScoped<IPaymobService>(sp => sp.GetRequiredService<PaymobService>());
}

builder.Services.AddBackgroundJobsAndEmails(builder.Configuration);

builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<SubmitReviewDtoValidator>();

builder.Services.AddSwaggerGen();
builder.Services.AddControllers();
builder.Services.AddSignalR();

var app = builder.Build();

await app.InitializeDatabaseAsync();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowAngular");
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseAuthentication();
app.UseMiddleware<EnforceBanMiddleware>();
app.UseAuthorization();
app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    Authorization = new[] { new HangfireAdminAuthorizationFilter() }
});

try
{
    app.MapControllers();
}
catch (ReflectionTypeLoadException ex)
{
    var sb = new StringBuilder();
    foreach (Exception? loaderEx in ex.LoaderExceptions)
    {
        sb.AppendLine(loaderEx?.Message);
        if (loaderEx is FileNotFoundException fileNotFound)
        {
            if (!string.IsNullOrEmpty(fileNotFound.FusionLog))
            {
                sb.AppendLine("Fusion Log:");
                sb.AppendLine(fileNotFound.FusionLog);
            }
        }
    }

    var errorMessage = sb.ToString();
    Console.WriteLine("ReflectionTypeLoadException details:");
    Console.WriteLine(errorMessage);
    throw new Exception($"Failed to load controllers. Details: {errorMessage}", ex);
}

app.MapHub<NotificationHub>("/hubs/notifications");

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var recurringJobManager = services.GetRequiredService<IRecurringJobManager>();
        recurringJobManager.AddOrUpdate<IPayoutService>(
            "daily-payouts",
            service => service.ProcessDailyPayoutsAsync(),
            Cron.Daily);
        // Expire approved bookings whose 24-hour payment window has lapsed
        recurringJobManager.AddOrUpdate<IBookingService>(
            "expire-approved-bookings",
            service => service.ExpireApprovedBookingsAsync(),
            "*/15 * * * *"); // every 15 minutes
        var dbContext = services.GetRequiredService<ApplicationDbContext>();

        // 1. هذا السطر ينشئ قاعدة البيانات إذا لم تكن موجودة، ويطبق أي Migrations جديدة
        await dbContext.Database.MigrateAsync();
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        await DatabaseSeeder.SeedAsync(roleManager, userManager);
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while seeding the database.");
    }
}


app.Run();
