namespace RentalsPlatform.Application.DTOs.Admin;

public class AdminFinancialSummaryDto
{
    public decimal TotalRevenue { get; init; }
    public int ActiveUsers { get; init; }
    public int PendingApprovals { get; init; }
}
