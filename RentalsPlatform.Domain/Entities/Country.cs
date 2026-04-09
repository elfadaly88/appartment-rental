using RentalsPlatform.Domain.Entities;

namespace RentalsPlatform.Domain.Entities;

public class Country
{
    public int Id { get; set; }
    public string NameAr { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public ICollection<Governorate> Governorates { get; set; } = new List<Governorate>();
}