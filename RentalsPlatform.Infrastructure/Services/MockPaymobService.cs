using Microsoft.AspNetCore.Http;
using RentalsPlatform.Application.DTOs.Payments;
using RentalsPlatform.Domain.Entities;

namespace RentalsPlatform.Infrastructure.Services;

public class MockPaymobService : IPaymobService
{
    public Task<string> GetAuthTokenAsync() => Task.FromResult("mock-auth-token");

    public Task<string> RegisterOrderAsync(string authToken, decimal amountCents, string currency)
        => Task.FromResult($"mock-order-{Guid.NewGuid():N}");

    public Task<string> GetPaymentKeyAsync(string authToken, string orderId, decimal amountCents, string currency, PaymobBillingData billingData, int integrationId, IReadOnlyCollection<PaymobSplitItem>? splits = null)
        => Task.FromResult($"mock-payment-key-{Guid.NewGuid():N}");

    public Task<string> CreatePaymentIframeUrlAsync(Booking booking)
        => GetUnifiedCheckoutUrlAsync(booking);

    public Task<string> GetUnifiedCheckoutUrlAsync(Booking booking)
        => Task.FromResult($"http://localhost:4200/checkout/mock-paymob?orderId={booking.Id}");

    public bool VerifyPaymobHmac(IQueryCollection query, string receivedHmac) => true;

    public Task<string> CreateSubMerchantAsync(string authToken, HostBankDetailsDto details)
        => Task.FromResult($"mock-sub-merchant-{Guid.NewGuid():N}");
}
