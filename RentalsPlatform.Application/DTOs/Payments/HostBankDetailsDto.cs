namespace RentalsPlatform.Application.DTOs.Payments;

public class HostBankDetailsDto
{
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string PhoneNumber { get; init; } = string.Empty;
    public string BankAccountNumber { get; init; } = string.Empty;
    public string BankIban { get; init; } = string.Empty;
    public string NationalId { get; init; } = string.Empty;
    public string AddressLine { get; init; } = string.Empty;
    public string City { get; init; } = string.Empty;
    public string Country { get; init; } = "EG";
}
