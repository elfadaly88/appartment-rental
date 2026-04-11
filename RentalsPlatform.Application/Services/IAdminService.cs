using RentalsPlatform.Application.Common;
using RentalsPlatform.Application.DTOs.Admin;

namespace RentalsPlatform.Application.Services;

public interface IAdminService
{
    Task<IEnumerable<AdminPropertyDto>> GetPendingPropertiesAsync();
    Task<Result> ApprovePropertyAsync(Guid propertyId);
    Task<Result> RejectPropertyAsync(Guid propertyId, string reason);
    Task<IEnumerable<AdminBookingDto>> GetAllBookingsAsync();
    Task<AdminFinancialSummaryDto> GetFinancialSummaryAsync();
}
