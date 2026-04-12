using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RentalsPlatform.Application.DTOs.Payments;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Infrastructure.Data;

namespace RentalsPlatform.Infrastructure.Services;

public class PaymobService : IPaymobService
{
    private const decimal PlatformCommissionRate = 0.10m;

    private readonly HttpClient _httpClient;
    private readonly PaymobSettings _settings;
    private readonly ApplicationDbContext _dbContext;

    public PaymobService(HttpClient httpClient, IOptions<PaymobSettings> settings, ApplicationDbContext dbContext)
    {
        _httpClient = httpClient;
        _settings = settings.Value;
        _dbContext = dbContext;
    }

    public async Task<string> GetAuthTokenAsync()
    {
        var response = await _httpClient.PostAsJsonAsync("auth/tokens", new
        {
            api_key = _settings.ApiKey
        });
        response.EnsureSuccessStatusCode();

        using var stream = await response.Content.ReadAsStreamAsync();
        using var document = await JsonDocument.ParseAsync(stream);

        return document.RootElement.GetProperty("token").GetString()
               ?? throw new InvalidOperationException("Paymob auth token is missing.");
    }

    public async Task<string> CreateSubMerchantAsync(string authToken, HostBankDetailsDto details)
    {
        var response = await _httpClient.PostAsJsonAsync("ecommerce/merchants/sub-merchants", new
        {
            auth_token = authToken,
            sub_merchants = new[]
            {
                new
                {
                    company_name = $"{details.FirstName} {details.LastName}".Trim(),
                    email = details.Email,
                    phone_number = details.PhoneNumber,
                    bank_account_number = details.BankAccountNumber,
                    bank_iban = details.BankIban,
                    address = details.AddressLine,
                    city = details.City,
                    country = details.Country,
                    national_id = details.NationalId
                }
            }
        });

        response.EnsureSuccessStatusCode();

        using var stream = await response.Content.ReadAsStreamAsync();
        using var document = await JsonDocument.ParseAsync(stream);

        if (document.RootElement.TryGetProperty("sub_merchants", out var subMerchantsElement)
            && subMerchantsElement.ValueKind == JsonValueKind.Array
            && subMerchantsElement.GetArrayLength() > 0)
        {
            var first = subMerchantsElement[0];
            if (first.TryGetProperty("sub_merchant_id", out var subIdElement))
            {
                var subId = subIdElement.GetRawText().Trim('"');
                if (!string.IsNullOrWhiteSpace(subId))
                    return subId;
            }
        }

        throw new InvalidOperationException("Paymob did not return a sub_merchant_id.");
    }

    public async Task<string> RegisterOrderAsync(string authToken, decimal amountCents, string currency)
    {
        var response = await _httpClient.PostAsJsonAsync("ecommerce/orders", new
        {
            auth_token = authToken,
            delivery_needed = false,
            amount_cents = Convert.ToInt32(decimal.Round(amountCents, 0, MidpointRounding.AwayFromZero)),
            currency,
            items = Array.Empty<object>()
        });

        response.EnsureSuccessStatusCode();

        using var stream = await response.Content.ReadAsStreamAsync();
        using var document = await JsonDocument.ParseAsync(stream);

        return document.RootElement.GetProperty("id").GetRawText().Trim('"');
    }

    public async Task<string> GetPaymentKeyAsync(
        string authToken,
        string orderId,
        decimal amountCents,
        string currency,
        PaymobBillingData billingData,
        int integrationId,
        IReadOnlyCollection<PaymobSplitItem>? splits = null)
    {
        var requestPayload = new Dictionary<string, object?>
        {
            ["auth_token"] = authToken,
            ["amount_cents"] = Convert.ToInt32(decimal.Round(amountCents, 0, MidpointRounding.AwayFromZero)),
            ["expiration"] = 3600,
            ["order_id"] = orderId,
            ["billing_data"] = new
            {
                apartment = billingData.Apartment,
                email = billingData.Email,
                floor = billingData.Floor,
                first_name = billingData.FirstName,
                street = billingData.Street,
                building = billingData.Building,
                phone_number = billingData.PhoneNumber,
                shipping_method = billingData.ShippingMethod,
                postal_code = billingData.PostalCode,
                city = billingData.City,
                country = billingData.Country,
                last_name = billingData.LastName,
                state = billingData.State
            },
            ["currency"] = currency,
            ["integration_id"] = integrationId,
            ["lock_order_when_paid"] = true
        };

        if (splits is { Count: > 0 })
        {
            requestPayload["split"] = splits.Select(s => new
            {
                sub_merchant_id = s.SubMerchantId,
                split_percentage = s.SplitPercentage,
                split_amount_cents = s.SplitAmountCents
            }).ToArray();
        }

        var response = await _httpClient.PostAsJsonAsync("acceptance/payment_keys", requestPayload);

        response.EnsureSuccessStatusCode();

        using var stream = await response.Content.ReadAsStreamAsync();
        using var document = await JsonDocument.ParseAsync(stream);

        return document.RootElement.GetProperty("token").GetString()
               ?? throw new InvalidOperationException("Paymob payment token is missing.");
    }

    public async Task<string> CreatePaymentIframeUrlAsync(Booking booking)
    {
        return await GetUnifiedCheckoutUrlAsync(booking);
    }

    public async Task<string> GetUnifiedCheckoutUrlAsync(Booking booking)
    {
        var authToken = await GetAuthTokenAsync();
        var amountCents = booking.TotalPrice.Amount * 100m;

        var orderId = await RegisterOrderAsync(authToken, amountCents, booking.TotalPrice.Currency);

        var property = await _dbContext.Properties
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == booking.PropertyId)
            ?? throw new InvalidOperationException("Property not found for booking.");

        var host = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == property.HostId.ToString())
            ?? throw new InvalidOperationException("Host account not found for booking property.");

        if (string.IsNullOrWhiteSpace(host.PaymobSubMerchantId))
            throw new InvalidOperationException("Host is not onboarded for split payments.");

        var platformShare = decimal.Round(booking.TotalPrice.Amount * PlatformCommissionRate, 2, MidpointRounding.AwayFromZero);
        var hostShare = booking.TotalPrice.Amount - platformShare;

        var platformShareCents = Convert.ToInt32(decimal.Round(platformShare * 100m, 0, MidpointRounding.AwayFromZero));
        var hostShareCents = Convert.ToInt32(decimal.Round(hostShare * 100m, 0, MidpointRounding.AwayFromZero));

        var totalCents = Convert.ToInt32(decimal.Round(amountCents, 0, MidpointRounding.AwayFromZero));
        if (platformShareCents + hostShareCents != totalCents)
        {
            hostShareCents = totalCents - platformShareCents;
        }

        var hostSplitPercentage = totalCents == 0
            ? 0
            : (int)Math.Round((decimal)hostShareCents / totalCents * 100m, MidpointRounding.AwayFromZero);

        var splits = new List<PaymobSplitItem>
        {
            new()
            {
                SubMerchantId = host.PaymobSubMerchantId,
                SplitPercentage = hostSplitPercentage,
                SplitAmountCents = hostShareCents
            }
        };

        var billingData = new PaymobBillingData
        {
            FirstName = string.IsNullOrWhiteSpace(host.FirstName) ? "NA" : host.FirstName,
            LastName = string.IsNullOrWhiteSpace(host.LastName) ? "NA" : host.LastName,
            Email = string.IsNullOrWhiteSpace(host.Email) ? "na@rentalsplatform.com" : host.Email,
            PhoneNumber = string.IsNullOrWhiteSpace(host.PhoneNumber) ? "NA" : host.PhoneNumber
        };

        var paymentKey = await GetPaymentKeyAsync(
            authToken,
            orderId,
            amountCents,
            booking.TotalPrice.Currency,
            billingData,
            _settings.IntegrationId,
            splits);

        var trackedBooking = await _dbContext.Bookings.FirstOrDefaultAsync(x => x.Id == booking.Id)
                            ?? throw new InvalidOperationException("Booking not found while persisting Paymob order id.");

        trackedBooking.SetPaymobOrderId(orderId);
        await _dbContext.SaveChangesAsync();

        return $"https://accept.paymob.com/api/acceptance/iframes/{_settings.IframeId}?payment_token={paymentKey}";
    }

    public bool VerifyPaymobHmac(IQueryCollection query, string receivedHmac)
    {
        if (string.IsNullOrWhiteSpace(receivedHmac) || string.IsNullOrWhiteSpace(_settings.HmacSecret))
            return false;

        static string V(IQueryCollection q, string key) => q.TryGetValue(key, out var value) ? value.ToString() : string.Empty;

        var concatenated = string.Concat(
            V(query, "amount_cents"),
            V(query, "created_at"),
            V(query, "currency"),
            V(query, "error_occured"),
            V(query, "has_parent_transaction"),
            V(query, "id"),
            V(query, "integration_id"),
            V(query, "is_3d_secure"),
            V(query, "is_auth"),
            V(query, "is_capture"),
            V(query, "is_refunded"),
            V(query, "is_standalone_payment"),
            V(query, "is_voided"),
            V(query, "order"),
            V(query, "owner"),
            V(query, "pending"),
            V(query, "source_data.pan"),
            V(query, "source_data.sub_type"),
            V(query, "source_data.type"),
            V(query, "success"));

        using var hmac = new HMACSHA512(Encoding.UTF8.GetBytes(_settings.HmacSecret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(concatenated));
        var computedHmac = Convert.ToHexString(hash).ToLowerInvariant();

        return string.Equals(computedHmac, receivedHmac.Trim(), StringComparison.OrdinalIgnoreCase);
    }
 public async Task<string> InitializeBookingPaymentAsync(string authToken, string bookingId)
{
    // 1. (اختياري هنا) هات بيانات الحجز من الداتا بيز عشان تحسب الـ Amount بجد
    // هنفترض حالياً مبلغ ثابت للتجربة أو إنك هتجيبه من الـ Repository
    var amountInCents = 10000; // 100 EGP

    // 2. تسجيل الطلب (Order Registration)
    var orderRequest = new
    {
        auth_token = authToken,
        delivery_needed = "false",
        amount_cents = amountInCents.ToString(),
        currency = "EGP",
        items = new[] {
            new { name = $"Booking {bookingId}", amount_cents = amountInCents.ToString(), description = "Apartment Rental" }
        }
    };

    var orderResponse = await _httpClient.PostAsJsonAsync("https://egypt.paymob.com/api/acceptance/steps/orders", orderRequest);
    var orderResult = await orderResponse.Content.ReadFromJsonAsync<dynamic>();
    string orderId = orderResult.id.ToString();

    // 3. طلب مفتاح الدفع (Payment Key Generation)
    // لازم تبعت الـ billing_data كاملة عشان الريكويست ما يرفضش
    var paymentKeyRequest = new
    {
        auth_token = authToken,
        amount_cents = amountInCents.ToString(),
        expiration = 3600, // ساعة واحدة
        order_id = orderId,
        billing_data = new
        {
            apartment = "NA",
            email = "guest@example.com", // المفروض تجيبه من بيانات الحجز
            floor = "NA",
            first_name = "Guest",
            street = "NA",
            building = "NA",
            phone_number = "+201234567890",
            shipping_method = "PKG",
            postal_code = "NA",
            city = "Cairo",
            country = "EG",
            last_name = "User",
            state = "Cairo"
        },
        currency = "EGP",
        integration_id = 456123 // حط الـ Integration ID (Card) بتاعك هنا من داشبورد باي موب
    };

    var keyResponse = await _httpClient.PostAsJsonAsync("https://egypt.paymob.com/api/acceptance/payment_keys", paymentKeyRequest);
    var keyResult = await keyResponse.Content.ReadFromJsonAsync<dynamic>();

    return keyResult.token.ToString(); // ده التوكن اللي هيروح للأنجيولار ويفتح الايفريم
}
}
