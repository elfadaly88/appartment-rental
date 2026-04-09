using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RentalsPlatform.Application.Services;
using RentalsPlatform.Domain.Enums;
using RentalsPlatform.Infrastructure.Data;

namespace RentalsPlatform.Infrastructure.Services;

public class PayoutService : IPayoutService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<PayoutService> _logger;

    public PayoutService(ApplicationDbContext context, ILogger<PayoutService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task ProcessDailyPayoutsAsync()
    {
        _logger.LogInformation("بدء عملية التسوية المالية اليومية...");

        // ... (باقي الكود اللي كتبناه في الرسالة اللي فاتت بالظبط)
    }
}