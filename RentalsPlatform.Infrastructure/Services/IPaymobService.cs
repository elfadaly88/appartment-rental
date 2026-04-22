using Microsoft.AspNetCore.Http;
using RentalsPlatform.Application.DTOs.Payments;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Domain.Enums;

namespace RentalsPlatform.Infrastructure.Services;

public interface IPaymobService
{
    Task<string> GetAuthTokenAsync();
    Task<string> RegisterOrderAsync(string authToken, decimal amountCents, string currency);
    Task<string> GetPaymentKeyAsync(string authToken, string orderId, decimal amountCents, string currency, PaymobBillingData billingData, int integrationId, IReadOnlyCollection<PaymobSplitItem>? splits = null);
    Task<string> CreatePaymentIframeUrlAsync(Booking booking);
    Task<string> GetUnifiedCheckoutUrlAsync(Booking booking);
    bool VerifyPaymobHmac(IQueryCollection query, string receivedHmac);
    Task<string> CreateSubMerchantAsync(string authToken, HostBankDetailsDto details);
    Task<InitiatePaymobResponseDto> InitializeBookingPaymentAsync(Guid bookingId);
    Task<PaymentStatus> GetBookingPaymentStatusAsync(Guid bookingId);
}
