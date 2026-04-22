using RentalsPlatform.Application.DTOs.Auth;

namespace RentalsPlatform.Application.Services;

public interface IAuthService
{
    Task<AuthResult> RegisterGuestAsync(RegisterDto dto);
    Task<AuthResult> RegisterHostAsync(RegisterDto dto);
    Task<AuthResult> LoginAsync(LoginDto dto);
    Task<AuthResult> ExternalLoginAsync(ExternalLoginDto dto);
}
