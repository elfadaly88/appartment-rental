using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using RentalsPlatform.Application.DTOs.Auth;
using RentalsPlatform.Application.Services;
using RentalsPlatform.Domain.Entities;

namespace RentalsPlatform.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly JwtSettings _jwtSettings;

    public AuthService(UserManager<ApplicationUser> userManager, IOptions<JwtSettings> jwtOptions)
    {
        _userManager = userManager;
        _jwtSettings = jwtOptions.Value;
    }

    public Task<AuthResult> RegisterGuestAsync(RegisterDto dto) => RegisterAsync(dto, "Guest");

    public Task<AuthResult> RegisterHostAsync(RegisterDto dto) => RegisterAsync(dto, "Host");

    public async Task<AuthResult> LoginAsync(LoginDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user is null)
        {
            return new AuthResult
            {
                IsSuccess = false,
                Message = "Invalid email or password.",
                Errors = ["Invalid email or password."]
            };
        }

        var isPasswordValid = await _userManager.CheckPasswordAsync(user, dto.Password);
        if (!isPasswordValid)
        {
            return new AuthResult
            {
                IsSuccess = false,
                Message = "Invalid email or password.",
                Errors = ["Invalid email or password."]
            };
        }

        var roles = await _userManager.GetRolesAsync(user);
        var token = GenerateJwtToken(user, roles);

        return new AuthResult
        {
            IsSuccess = true,
            Message = "Login successful.",
            Token = token.Token,
            ExpiresAtUtc = token.ExpiresAtUtc,
            UserId = user.Id,
            Email = user.Email,
            FullName = user.FullName,
            Roles = roles.ToArray()
        };
    }

    private async Task<AuthResult> RegisterAsync(RegisterDto dto, string role)
    {
        var existingUser = await _userManager.FindByEmailAsync(dto.Email);
        if (existingUser is not null)
        {
            return new AuthResult
            {
                IsSuccess = false,
                Message = "Email is already registered.",
                Errors = ["Email is already registered."]
            };
        }

        var user = new ApplicationUser
        {
            UserName = dto.Email,
            Email = dto.Email,
            FullName = dto.FullName,
            ProfilePictureUrl = dto.ProfilePictureUrl
        };

        var createResult = await _userManager.CreateAsync(user, dto.Password);
        if (!createResult.Succeeded)
        {
            return new AuthResult
            {
                IsSuccess = false,
                Message = "User registration failed.",
                Errors = createResult.Errors.Select(e => e.Description).ToArray()
            };
        }

        var roleResult = await _userManager.AddToRoleAsync(user, role);
        if (!roleResult.Succeeded)
        {
            await _userManager.DeleteAsync(user);
            return new AuthResult
            {
                IsSuccess = false,
                Message = "User registration failed while assigning role.",
                Errors = roleResult.Errors.Select(e => e.Description).ToArray()
            };
        }

        return new AuthResult
        {
            IsSuccess = true,
            Message = "User registered successfully.",
            UserId = user.Id,
            Email = user.Email,
            FullName = user.FullName,
            Roles = [role]
        };
    }

    private (string Token, DateTime ExpiresAtUtc) GenerateJwtToken(ApplicationUser user, IEnumerable<string> roles)
    {
        if (string.IsNullOrWhiteSpace(_jwtSettings.Key))
            throw new InvalidOperationException("JWT Key is not configured.");

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new("UserId", user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(ClaimTypes.Email, user.Email ?? string.Empty),
            new("FullName", user.FullName ?? string.Empty),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.Key));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresAtUtc = DateTime.UtcNow.AddDays(7);

        var token = new JwtSecurityToken(
            issuer: _jwtSettings.Issuer,
            audience: _jwtSettings.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expiresAtUtc,
            signingCredentials: credentials);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAtUtc);
    }
}
