using RentalsPlatform.Domain.Enums;

namespace RentalsPlatform.Application.DTOs.Properties;

public class CreatePropertyFeeDto
{
    public int FeeTypeId { get; set; }
    public decimal Amount { get; set; }
    public FeeCalculationType CalculationType { get; set; }
}
