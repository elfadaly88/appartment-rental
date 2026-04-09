namespace RentalsPlatform.Domain.Entities;

public class City
{
    public int Id { get; set; }
    public int GovernorateId { get; set; }
    public string NameAr { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public Governorate Governorate { get; set; } = null!;
}