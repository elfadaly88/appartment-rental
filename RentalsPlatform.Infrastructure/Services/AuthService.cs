using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using RentalsPlatform.Application.DTOs.Auth;
using RentalsPlatform.Application.Services;
using RentalsPlatform.Domain.Entities;
using Microsoft.Extensions.Configuration;

namespace RentalsPlatform.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly JwtSettings _jwtSettings;
    private readonly ExternalAuthSettings _externalAuthSettings;
    private readonly IHttpClientFactory _httpClientFactory;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        IOptions<JwtSettings> jwtOptions,
        IOptions<ExternalAuthSettings> externalAuthOptions,
        IHttpClientFactory httpClientFactory)
    {
        _userManager = userManager;
        _jwtSettings = jwtOptions.Value;
        _externalAuthSettings = externalAuthOptions.Value;
        _httpClientFactory = httpClientFactory;
    }

    public Task<AuthResult> RegisterGuestAsync(RegisterDto dto) => RegisterAsync(dto, "Guest");

    public Task<AuthResult> RegisterHostAsync(RegisterDto dto) => RegisterAsync(dto, "Host");

    public async Task<AuthResult> ExternalLoginAsync(ExternalLoginDto dto)
    {
        ExternalUserProfile externalProfile;
        ExternalProviderInfo providerInfo;

        try
        {
            providerInfo = ResolveProvider(dto.Provider);
        }
        catch (ArgumentOutOfRangeException)
        {
            return CreateFailure("Unsupported external login provider.");
        }

        try
        {
            externalProfile = providerInfo.Provider switch
            {
                "Google" => await ValidateGoogleAsync(dto),
                "Facebook" => await ValidateFacebookAsync(dto),
                _ => throw new InvalidOperationException("Unsupported external login provider.")
            };
        }
        catch (Exception ex)
        {
            return CreateFailure(ex.Message);
        }

        if (string.IsNullOrWhiteSpace(externalProfile.Email))
        {
            return CreateFailure("The external provider did not return a verified email address.");
        }

        // البحث عن اليوزر عن طريق الربط الخارجي أولاً
        var user = await _userManager.FindByLoginAsync(providerInfo.Provider, externalProfile.ProviderUserId);

        if (user is null)
        {
            // البحث عن اليوزر عن طريق الإيميل لو ملوش ربط خارجي
            user = await _userManager.FindByEmailAsync(externalProfile.Email);
        }

        if (user is null)
        {
            var desiredRole = NormalizeRequestedRole(dto.Role);
            if (desiredRole == "Host" && !dto.AcceptedHostTerms)
            {
                return CreateFailure("Host terms must be accepted before creating a host account.");
            }

            user = CreateExternalUser(externalProfile);

            var createResult = await _userManager.CreateAsync(user);
            if (!createResult.Succeeded)
            {
                return CreateFailure("Unable to create the external account.", createResult.Errors.Select(e => e.Description));
            }

            var roleResult = await _userManager.AddToRoleAsync(user, desiredRole);
            if (!roleResult.Succeeded)
            {
                await _userManager.DeleteAsync(user);
                return CreateFailure("Unable to assign the requested role.", roleResult.Errors.Select(e => e.Description));
            }
        }

        // التأكد من ربط حساب جوجل/فيسبوك باليوزر المحلي
        var loginResult = await EnsureExternalLoginLinkedAsync(user, providerInfo, externalProfile.ProviderUserId);
        if (!loginResult.Succeeded)
        {
            return CreateFailure("Unable to link the external login to this account.", loginResult.Errors.Select(e => e.Description));
        }

        // تحديث بيانات البروفايل (الاسم والصورة) لو اتغيروا في جوجل
        var profileUpdated = ApplyExternalProfile(user, externalProfile);
        if (profileUpdated)
        {
            await _userManager.UpdateAsync(user);
        }

        var roles = await _userManager.GetRolesAsync(user);
        if (roles.Count == 0)
        {
            var fallbackRole = NormalizeRequestedRole(dto.Role);
            await _userManager.AddToRoleAsync(user, fallbackRole);
            roles = await _userManager.GetRolesAsync(user);
        }

        return BuildSuccessResult(user, roles, providerInfo.Provider);
    }

    public async Task<AuthResult> LoginAsync(LoginDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user is null) return CreateFailure("Invalid email or password.");

        var isPasswordValid = await _userManager.CheckPasswordAsync(user, dto.Password);
        if (!isPasswordValid) return CreateFailure("Invalid email or password.");

        var roles = await _userManager.GetRolesAsync(user);
        return BuildSuccessResult(user, roles, provider: null, message: "Login successful.");
    }

    private async Task<AuthResult> RegisterAsync(RegisterDto dto, string role)
    {
        if (role == "Host" && !dto.AcceptedHostTerms)
            return CreateFailure("Host terms must be accepted.");

        var existingUser = await _userManager.FindByEmailAsync(dto.Email);
        if (existingUser is not null) return CreateFailure("Email is already registered.");

        var user = new ApplicationUser
        {
            UserName = dto.Email,
            Email = dto.Email,
            FullName = dto.FullName,
            DisplayName = dto.FullName,
            ProfilePictureUrl = dto.ProfilePictureUrl,
            AvatarUrl = dto.ProfilePictureUrl
        };

        var createResult = await _userManager.CreateAsync(user, dto.Password);
        if (!createResult.Succeeded)
            return CreateFailure("Registration failed.", createResult.Errors.Select(e => e.Description));

        await _userManager.AddToRoleAsync(user, role);
        return BuildSuccessResult(user, [role], provider: null, message: "Registered successfully.");
    }

    private (string Token, DateTime ExpiresAtUtc) GenerateJwtToken(ApplicationUser user, IEnumerable<string> roles)
    {
        var avatarUrl = user.AvatarUrl ?? user.ProfilePictureUrl ?? "";
        if (avatarUrl.StartsWith("data:image"))
        {
            avatarUrl = ""; // Never embed Base64 image data in JWT
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email ?? ""),
            new("FullName", user.FullName ?? ""),
            new("AvatarUrl", avatarUrl),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.Key));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddMinutes(_jwtSettings.DurationInMinutes);

        var token = new JwtSecurityToken(
            _jwtSettings.Issuer,
            _jwtSettings.Audience,
            claims,
            expires: expires,
            signingCredentials: creds
        );

        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }

    private AuthResult BuildSuccessResult(ApplicationUser user, IEnumerable<string> roles, string? provider, string? message = null)
    {
        var normalizedRoles = roles.ToArray();
        var tokenData = GenerateJwtToken(user, normalizedRoles);

        return new AuthResult
        {
            IsSuccess = true,
            Message = message ?? "Success",
            Token = tokenData.Token,
            ExpiresAtUtc = tokenData.ExpiresAtUtc,
            UserId = user.Id,
            Email = user.Email ?? "",
            FullName = user.FullName,
            Roles = normalizedRoles,
            Provider = provider,
            User = new AuthUserDto
            {
                Id = user.Id,
                Email = user.Email ?? "",
                FullName = user.FullName,
                DisplayName = user.DisplayName ?? user.FullName,
                AvatarUrl = user.AvatarUrl ?? user.ProfilePictureUrl,
                Roles = normalizedRoles
            }
        };
    }

    private static AuthResult CreateFailure(string message, IEnumerable<string>? errors = null)
    {
        return new AuthResult { IsSuccess = false, Message = message, Errors = errors?.ToArray() ?? [message] };
    }

    private static string NormalizeRequestedRole(string? requestedRole) =>
        string.Equals(requestedRole, "host", StringComparison.OrdinalIgnoreCase) ? "Host" : "Guest";

    private static ExternalProviderInfo ResolveProvider(string provider) =>
        provider.ToLowerInvariant() switch
        {
            "google" => new ExternalProviderInfo("Google", "Google"),
            "facebook" => new ExternalProviderInfo("Facebook", "Facebook"),
            _ => throw new ArgumentOutOfRangeException(nameof(provider), "Unsupported provider.")
        };

    private ApplicationUser CreateExternalUser(ExternalUserProfile externalProfile) => new ApplicationUser
    {
        UserName = externalProfile.Email,
        Email = externalProfile.Email,
        EmailConfirmed = true,
        FullName = externalProfile.Name,
        DisplayName = externalProfile.Name,
        ProfilePictureUrl = externalProfile.PictureUrl,
        AvatarUrl = externalProfile.PictureUrl
    };

    private async Task<IdentityResult> EnsureExternalLoginLinkedAsync(ApplicationUser user, ExternalProviderInfo providerInfo, string providerUserId)
    {
        var logins = await _userManager.GetLoginsAsync(user);
        if (logins.Any(l => l.LoginProvider == providerInfo.Provider && l.ProviderKey == providerUserId))
            return IdentityResult.Success;

        return await _userManager.AddLoginAsync(user, new UserLoginInfo(providerInfo.Provider, providerUserId, providerInfo.DisplayName));
    }

    private static bool ApplyExternalProfile(ApplicationUser user, ExternalUserProfile externalProfile)
    {
        bool updated = false;
        if (string.IsNullOrEmpty(user.AvatarUrl) && !string.IsNullOrEmpty(externalProfile.PictureUrl))
        {
            user.AvatarUrl = externalProfile.PictureUrl;
            user.ProfilePictureUrl = externalProfile.PictureUrl;
            updated = true;
        }
        return updated;
    }

    private async Task<ExternalUserProfile> ValidateGoogleAsync(ExternalLoginDto dto)
    {
        var payload = await GoogleJsonWebSignature.ValidateAsync(dto.IdToken, new GoogleJsonWebSignature.ValidationSettings
        {
            Audience = new[] { _externalAuthSettings.Google.ClientId }
        });

        return new ExternalUserProfile(payload.Subject, payload.Email, payload.Name, payload.Picture);
    }

    private async Task<ExternalUserProfile> ValidateFacebookAsync(ExternalLoginDto dto)
    {
        var httpClient = _httpClientFactory.CreateClient("SocialAuth");
        var appToken = $"{_externalAuthSettings.Facebook.AppId}|{_externalAuthSettings.Facebook.AppSecret}";

        var debug = await httpClient.GetFromJsonAsync<FacebookDebugResponse>(
            $"https://graph.facebook.com/debug_token?input_token={dto.AccessToken}&access_token={appToken}");

        if (debug?.Data?.IsValid != true) throw new Exception("Invalid Facebook token.");

        var profile = await httpClient.GetFromJsonAsync<FacebookProfileResponse>(
            $"https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token={dto.AccessToken}");

        return new ExternalUserProfile(profile!.Id!, profile.Email!, profile.Name!, profile.Picture?.Data?.Url);
    }

    // Records & Helper Classes
    private record ExternalProviderInfo(string Provider, string DisplayName);
    private record ExternalUserProfile(string ProviderUserId, string Email, string Name, string? PictureUrl);
    private class FacebookDebugResponse { public FacebookDebugData? Data { get; set; } }
    private class FacebookDebugData { [JsonPropertyName("is_valid")] public bool IsValid { get; set; } }
    private class FacebookProfileResponse { public string? Id { get; set; } public string? Name { get; set; } public string? Email { get; set; } public FacebookPictureResponse? Picture { get; set; } }
    private class FacebookPictureResponse { public FacebookPictureData? Data { get; set; } }
    private class FacebookPictureData { public string? Url { get; set; } }
}