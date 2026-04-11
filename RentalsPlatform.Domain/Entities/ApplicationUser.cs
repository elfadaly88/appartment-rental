using Microsoft.AspNetCore.Identity;

namespace RentalsPlatform.Domain.Entities;

public class ApplicationUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? ProfilePictureUrl { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string? Bio { get; set; }
    public DateTime JoinedDate { get; set; } = DateTime.UtcNow;
    public string? BanReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? PaymobSubMerchantId { get; set; }
    public string BankAccountNumber { get; set; } = string.Empty;
}
