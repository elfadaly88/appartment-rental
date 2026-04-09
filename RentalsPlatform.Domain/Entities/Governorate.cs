namespace RentalsPlatform.Domain.Entities;

public class Governorate
{
    public int Id { get; set; }
    public int CountryId { get; set; }
    public string NameAr { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public Country Country { get; set; } = null!;
    public ICollection<City> Cities { get; set; } = new List<City>();
}