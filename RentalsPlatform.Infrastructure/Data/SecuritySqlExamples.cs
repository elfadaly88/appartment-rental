using Microsoft.EntityFrameworkCore;

namespace RentalsPlatform.Infrastructure.Data;

public static class SecuritySqlExamples
{
    public static async Task<int> MarkExpiredPendingBookingsAsCancelledAsync(
        ApplicationDbContext context,
        DateOnly cutoffDate,
        CancellationToken cancellationToken = default)
    {
        return await context.Database.ExecuteSqlInterpolatedAsync(
            $"""
            UPDATE "Bookings"
            SET "Status" = {3}
            WHERE "Status" = {1} AND "EndDate" < {cutoffDate}
            """,
            cancellationToken);
    }

    // NEVER DO THIS:
    // var sql = $"UPDATE \"Bookings\" SET \"Status\" = 3 WHERE \"GuestId\" = '{userInput}'";
    // await context.Database.ExecuteSqlRawAsync(sql);
    // Catastrophic vulnerability: attacker-controlled input is concatenated directly into SQL,
    // allowing SQL Injection (data theft, privilege escalation, destructive writes).
}
