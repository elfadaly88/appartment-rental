namespace RentalsPlatform.Domain.ValueObjects;

public record Address
{
    public string Country { get; init; }
    public string City { get; init; }
    public string Street { get; init; }
    public string ZipCode { get; init; }
    public string MapUrl { get; init; }

    // 1. الكونستراكتور ده إجباري عشان EF Core يعرف يقرأ الداتا من قاعدة البيانات
    private Address() { }

    // 2. الكونستراكتور ده بتاعنا إحنا في البزنس لوجيك (وفيه الـ Validation)
    public Address(string country, string city, string street, string zipCode, string mapUrl)
    {
        if (!string.IsNullOrEmpty(mapUrl) && !mapUrl.StartsWith("http"))
            throw new ArgumentException("Invalid Google Maps URL");

        Country = country;
        City = city;
        Street = street;
        ZipCode = zipCode;
        MapUrl = mapUrl;
    }
}