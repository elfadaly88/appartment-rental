using RentalsPlatform.Domain.Enums;

namespace RentalsPlatform.Domain.Entities;

public class PropertyFee
{
    public Guid Id { get; private set; }
    public Guid PropertyId { get; private set; }
    public int FeeTypeId { get; private set; }
    public decimal Amount { get; private set; }
    public FeeCalculationType CalculationType { get; private set; }

    public Property? Property { get; private set; }
    public FeeType? FeeType { get; private set; }

    private PropertyFee() { }

    public PropertyFee(Guid propertyId, int feeTypeId, decimal amount, FeeCalculationType calculationType)
    {
        Id = Guid.NewGuid();
        PropertyId = propertyId;
        FeeTypeId = feeTypeId;
        Amount = amount;
        CalculationType = calculationType;
    }

    public void Update(decimal amount, FeeCalculationType calculationType)
    {
        Amount = amount;
        CalculationType = calculationType;
    }
}
