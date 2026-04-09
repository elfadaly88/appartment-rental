namespace RentalsPlatform.Domain.Entities;

public class PropertyImage
{
    public Guid Id { get; private set; }
    public Guid PropertyId { get; private set; }
    public string Url { get; private set; } = string.Empty;
    public string PublicId { get; private set; } = string.Empty;
    public bool IsMain { get; private set; }

    private PropertyImage() { }

    public PropertyImage(Guid propertyId, string url, string publicId, bool isMain)
    {
        if (propertyId == Guid.Empty)
            throw new ArgumentException("Property id is required.", nameof(propertyId));

        if (string.IsNullOrWhiteSpace(url))
            throw new ArgumentException("Image url is required.", nameof(url));

        if (string.IsNullOrWhiteSpace(publicId))
            throw new ArgumentException("Image public id is required.", nameof(publicId));

        Id = Guid.NewGuid();
        PropertyId = propertyId;
        Url = url.Trim();
        PublicId = publicId.Trim();
        IsMain = isMain;
    }

    public void SetAsMain()
    {
        IsMain = true;
    }

    public void SetAsNotMain()
    {
        IsMain = false;
    }
}
