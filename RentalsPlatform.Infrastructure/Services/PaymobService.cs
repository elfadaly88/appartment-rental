using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RentalsPlatform.Application.Common;
using RentalsPlatform.Application.DTOs.Payments;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Domain.Enums;
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
        await EnsureSuccessOrThrowWithBodyAsync(response, "Paymob auth token request failed");

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

        await EnsureSuccessOrThrowWithBodyAsync(response, "Paymob sub-merchant creation failed");

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

        await EnsureSuccessOrThrowWithBodyAsync(response, "Paymob order registration failed");

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
        var normalizedBillingData = NormalizeBillingData(billingData);

        var requestPayload = new Dictionary<string, object?>
        {
            ["auth_token"] = authToken,
            ["amount_cents"] = Convert.ToInt32(decimal.Round(amountCents, 0, MidpointRounding.AwayFromZero)),
            ["expiration"] = 3600,
            ["order_id"] = orderId,
            ["billing_data"] = new
            {
                apartment = normalizedBillingData.Apartment,
                email = normalizedBillingData.Email,
                floor = normalizedBillingData.Floor,
                first_name = normalizedBillingData.FirstName,
                street = normalizedBillingData.Street,
                building = normalizedBillingData.Building,
                phone_number = normalizedBillingData.PhoneNumber,
                shipping_method = normalizedBillingData.ShippingMethod,
                postal_code = normalizedBillingData.PostalCode,
                city = normalizedBillingData.City,
                country = normalizedBillingData.Country,
                last_name = normalizedBillingData.LastName,
                state = normalizedBillingData.State
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

        await EnsureSuccessOrThrowWithBodyAsync(response, "Paymob payment key request failed");

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
        var amountCents = Convert.ToInt32(decimal.Round(booking.TotalPrice.Amount * 100m, 0, MidpointRounding.AwayFromZero));

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

        var platformShareCents = Convert.ToInt32(decimal.Round(booking.TotalPrice.Amount * PlatformCommissionRate * 100m, 0, MidpointRounding.AwayFromZero));
        var hostShareCents = amountCents - platformShareCents;

        var billingData = new PaymobBillingData
        {
            FirstName = string.IsNullOrWhiteSpace(host.FirstName) ? "NA" : host.FirstName,
            LastName = string.IsNullOrWhiteSpace(host.LastName) ? "NA" : host.LastName,
            Email = string.IsNullOrWhiteSpace(host.Email) ? "na@rentalsplatform.com" : host.Email,
            PhoneNumber = string.IsNullOrWhiteSpace(host.PhoneNumber) ? "NA" : host.PhoneNumber
        };

        var subDeals = new Dictionary<string, object>
        {
            [host.PaymobSubMerchantId] = new { total_amount = hostShareCents, currency = booking.TotalPrice.Currency }
        };

        var (clientSecret, intentionId) = await CreateIntentionAsync(
            amountCents,
            booking.TotalPrice.Currency,
            $"{booking.Id:N}-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}",
            billingData,
            subDeals);

        var trackedBooking = await _dbContext.Bookings.FirstOrDefaultAsync(x => x.Id == booking.Id)
                            ?? throw new InvalidOperationException("Booking not found while persisting Paymob order id.");

        trackedBooking.SetPaymobOrderId(intentionId);
        await _dbContext.SaveChangesAsync();

        return BuildUnifiedCheckoutUrl(_settings.PublicKey, clientSecret);
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
    public async Task<InitiatePaymobResponseDto> InitializeBookingPaymentAsync(Guid bookingId)
    {
        if (_settings.IntegrationId <= 0)
            throw new InvalidOperationException("Paymob IntegrationId is missing from configuration.");

        var booking = await _dbContext.Bookings
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == bookingId)
            ?? throw new InvalidOperationException("Booking not found.");

        if (booking.TotalPrice.Amount <= 0)
            throw new InvalidOperationException("Booking total amount must be greater than zero.");

        var guest = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == booking.GuestId.ToString())
            ?? throw new InvalidOperationException("Guest account not found.");

        var amountCents = Convert.ToInt32(decimal.Round(booking.TotalPrice.Amount * 100m, 0, MidpointRounding.AwayFromZero));
        var specialReference = $"{booking.Id:N}-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";

        var billingData = new PaymobBillingData
        {
            FirstName = string.IsNullOrWhiteSpace(guest.FirstName) ? "NA" : guest.FirstName,
            LastName = string.IsNullOrWhiteSpace(guest.LastName) ? "NA" : guest.LastName,
            Email = string.IsNullOrWhiteSpace(guest.Email) ? "na@rentalsplatform.com" : guest.Email,
            PhoneNumber = string.IsNullOrWhiteSpace(guest.PhoneNumber) ? "NA" : guest.PhoneNumber
        };

        var (clientSecret, intentionId) = await CreateIntentionAsync(
            amountCents,
            booking.TotalPrice.Currency,
            specialReference,
            billingData);

        var trackedBooking = await _dbContext.Bookings.FirstOrDefaultAsync(x => x.Id == booking.Id)
            ?? throw new InvalidOperationException("Booking not found while saving Paymob order id.");

        trackedBooking.SetPaymobOrderId(intentionId);
        await _dbContext.SaveChangesAsync();

        return new InitiatePaymobResponseDto
        {
            BookingId = booking.Id,
            OrderId = intentionId,
            PaymentKey = clientSecret,
            PublicKey = _settings.PublicKey,
            CheckoutUrl = BuildUnifiedCheckoutUrl(_settings.PublicKey, clientSecret),
            CallbackUrl = _settings.CheckoutReturnUrl
        };
    }

    private static string BuildUnifiedCheckoutUrl(string publicKey, string clientSecret)
    {
        var encodedPublicKey = Uri.EscapeDataString(publicKey ?? string.Empty);
        var encodedClientSecret = Uri.EscapeDataString(clientSecret ?? string.Empty);
        return $"https://accept.paymob.com/unifiedcheckout/?publicKey={encodedPublicKey}&clientSecret={encodedClientSecret}";
    }

    private async Task<(string ClientSecret, string IntentionId)> CreateIntentionAsync(
        int amountCents,
        string currency,
        string specialReference,
        PaymobBillingData billingData,
        Dictionary<string, object>? subDeals = null)
    {
        var normalized = NormalizeBillingData(billingData);

        var payload = new Dictionary<string, object>
        {
            ["amount"] = amountCents,
            ["currency"] = currency,
            ["payment_methods"] = new[] { _settings.IntegrationId },
            ["items"] = Array.Empty<object>(),
            ["billing_data"] = new
            {
                first_name = normalized.FirstName,
                last_name = normalized.LastName,
                email = normalized.Email,
                phone_number = normalized.PhoneNumber,
                apartment = normalized.Apartment ?? "NA",
                floor = normalized.Floor ?? "NA",
                street = normalized.Street ?? "NA",
                building = normalized.Building ?? "NA",
                shipping_method = normalized.ShippingMethod ?? "PKG",
                postal_code = normalized.PostalCode ?? "NA",
                city = normalized.City ?? "NA",
                country = normalized.Country ?? "EG",
                state = normalized.State ?? "NA"
            },
            ["customer"] = new
            {
                first_name = normalized.FirstName,
                last_name = normalized.LastName,
                email = normalized.Email
            },
            ["special_reference"] = specialReference,
            ["redirection_url"] = _settings.CheckoutReturnUrl
        };

        if (subDeals is { Count: > 0 })
            payload["sub_deals"] = subDeals;

        var request = new HttpRequestMessage(HttpMethod.Post, "https://accept.paymob.com/v1/intention/");
        request.Headers.Add("Authorization", $"Token {_settings.SecretKey}");
        request.Content = JsonContent.Create(payload);

        var response = await _httpClient.SendAsync(request);
        await EnsureSuccessOrThrowWithBodyAsync(response, "Paymob intention creation failed");

        await using var stream = await response.Content.ReadAsStreamAsync();
        using var document = await JsonDocument.ParseAsync(stream);

        var clientSecret = document.RootElement.GetProperty("client_secret").GetString()
            ?? throw new InvalidOperationException("Paymob intention client_secret is missing.");
        var intentionId = document.RootElement.GetProperty("id").GetRawText().Trim('"');

        return (clientSecret, intentionId);
    }

    private static PaymobBillingData NormalizeBillingData(PaymobBillingData data)
    {
        var email = string.IsNullOrWhiteSpace(data.Email) ? "na@rentalsplatform.com" : data.Email.Trim();
        if (!email.Contains('@'))
            throw new InvalidOperationException("Guest profile must include a valid email before payment.");

        var phone = EgyptianPhoneNumber.NormalizeToLocal(data.PhoneNumber);
        if (!EgyptianPhoneNumber.IsValidLocal(phone))
            throw new InvalidOperationException("Guest profile must include a valid phone number before payment.");

        var country = string.IsNullOrWhiteSpace(data.Country) || data.Country.Equals("NA", StringComparison.OrdinalIgnoreCase)
            ? "EG"
            : data.Country.Trim();

        return new PaymobBillingData
        {
            FirstName = string.IsNullOrWhiteSpace(data.FirstName) ? "NA" : data.FirstName,
            LastName = string.IsNullOrWhiteSpace(data.LastName) ? "NA" : data.LastName,
            Email = email,
            PhoneNumber = phone,
            Apartment = string.IsNullOrWhiteSpace(data.Apartment) ? "NA" : data.Apartment,
            Floor = string.IsNullOrWhiteSpace(data.Floor) ? "NA" : data.Floor,
            Street = string.IsNullOrWhiteSpace(data.Street) ? "NA" : data.Street,
            Building = string.IsNullOrWhiteSpace(data.Building) ? "NA" : data.Building,
            ShippingMethod = string.IsNullOrWhiteSpace(data.ShippingMethod) ? "PKG" : data.ShippingMethod,
            PostalCode = string.IsNullOrWhiteSpace(data.PostalCode) ? "00000" : data.PostalCode,
            City = string.IsNullOrWhiteSpace(data.City) ? "NA" : data.City,
            Country = country,
            State = string.IsNullOrWhiteSpace(data.State) ? "NA" : data.State
        };
    }

    private static async Task EnsureSuccessOrThrowWithBodyAsync(HttpResponseMessage response, string context)
    {
        if (response.IsSuccessStatusCode)
            return;

        var body = await response.Content.ReadAsStringAsync();
        var detail = string.IsNullOrWhiteSpace(body) ? "No response body." : body;
        throw new HttpRequestException($"{context}. Status: {(int)response.StatusCode} ({response.StatusCode}). Body: {detail}", null, response.StatusCode);
    }

    public async Task<PaymentStatus> GetBookingPaymentStatusAsync(Guid bookingId)
    {
        var booking = await _dbContext.Bookings
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == bookingId)
            ?? throw new InvalidOperationException("Booking not found.");

        return booking.PaymentStatus;
    }
}
